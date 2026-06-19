import { Injectable, inject } from '@angular/core';
import { OAuthPipelineOrchestrator } from '../services-workers/OAuthPipelineOrquestrator';
import { SessionContext } from '../context/session.context';
import { OauthContext } from '../context/oauth.context';
import { OAuthTag } from '../models/oauth.model';
import { PrismoSessionState } from '../models/session.model';
import { AppError, ErrorAccumulator } from '../models/error.model';
import { encryptJson } from '../helpers/session.helpers';

declare global {
  interface Window { Pi: any; }
}

// ─────────────────────────────────────────────────────────────────
// CONTRATOS E MODELOS
// ─────────────────────────────────────────────────────────────────
export type AuthResult = {
  accessToken: string;
  user: { uid: string; username: string };
};

export class AuthModel {
  public accessToken: string | null;
  public user: { uid: string | null; username: string | null };

  constructor(data: Partial<AuthResult> | null | undefined) {
    this.accessToken = data?.accessToken || null;
    this.user = { uid: data?.user?.uid || null, username: data?.user?.username || null };
  }

  isValid(): boolean {
    return !!(this.accessToken && this.user.username && this.user.uid);
  }
}

const LOG_STYLES = {
  success: 'background: #10b981; color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  payload: 'background: #8b5cf6; color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  error:   'background: #ef4444; color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  debug:   'background: #f59e0b; color: #000; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  crypto:  'background: #3b82f6; color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  rsa:     'background: #7c3aed; color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
};

// Envelope AES-GCM produzido por encryptJson()
interface DhSignedEnvelope {
  iv:         string;
  ciphertext: string;
}

// ─────────────────────────────────────────────────────────────────
// HELPERS RSA-OAEP (SubtleCrypto — off-thread seguro)
// ─────────────────────────────────────────────────────────────────

/**
 * Gera um par de chaves RSA-OAEP 2048-bit com SHA-256.
 * Parâmetros idênticos ao que o Java espera:
 *   OAEPParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec("SHA-256"), DEFAULT)
 */
async function generateRsaOaepKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name:           'RSA-OAEP',
      modulusLength:  2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
      hash:           'SHA-256'
    },
    true,               // exportável (precisamos exportar a public key)
    ['encrypt', 'decrypt']
  );
}

/**
 * Exporta a chave pública como SPKI → base64
 * (formato que o Java importa via X509EncodedKeySpec)
 */
async function exportPublicKeyBase64(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', publicKey);
  return btoa(String.fromCharCode(...new Uint8Array(spki)));
}

/**
 * Decifra o challenge RSA-OAEP que o servidor enviou cifrado com a public key.
 * Só o detentor da private key consegue abrir.
 */
async function decryptRsaChallenge(
  rsaEncryptedChallengeBase64: string,
  privateKey: CryptoKey
): Promise<string> {
  const cipherBytes = Uint8Array.from(atob(rsaEncryptedChallengeBase64), c => c.charCodeAt(0));
  const decrypted   = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, cipherBytes);
  return new TextDecoder().decode(decrypted);
}

// ─────────────────────────────────────────────────────────────────
// EXECUÇÃO PRINCIPAL
// ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class OAuthPiConnectExecution {
  private orchestrator   = inject(OAuthPipelineOrchestrator);
  private sessionContext = inject(SessionContext);
  private oauthContext   = inject(OauthContext);

  public errorTracker = new ErrorAccumulator('OAuthPiConnectPipeline');

  async run(): Promise<any> {
    console.log(
      `%c🔒 [OAUTH_PI]%c Iniciando esteira dual-crypto: AES-GCM(DH) + RSA-OAEP.`,
      LOG_STYLES.crypto, ''
    );

    const sessionState: PrismoSessionState = this.sessionContext.currentState;

    if (!sessionState.data?.id_prospect) {
      this.oauthContext.setOperation(OAuthTag.VOID);
      throw new AppError('Falha de Contexto: id_prospect indisponível.', 'VALIDATION_ERROR');
    }

    // ── Camada 1: Shared Secret do túnel DH estabelecido na sessão ──────────
    const sharedSecret = sessionState.metadata?.[1]?.sharedSecret;
    if (!sharedSecret) {
      this.oauthContext.setOperation(OAuthTag.VOID);
      throw new AppError(
        'Shared Secret ausente: handshake DH da sessão não estabelecido.',
        'AUTH_ERROR'
      );
    }
    console.log(`%c🔑 [DH]%c Shared Secret DH ativo no contexto de sessão.`, LOG_STYLES.crypto, '');

    try {
      // ══════════════════════════════════════════════════════════════════════
      // STAGE 3 — GERAÇÃO DO PAR RSA-OAEP (Camada 2 de identidade)
      // ══════════════════════════════════════════════════════════════════════
      console.log(`%c🔐 [RSA]%c Gerando par RSA-OAEP 2048-bit SHA-256...`, LOG_STYLES.rsa, '');

      const rsaKeyPair         = await generateRsaOaepKeyPair();
      const clientPublicKeyRSA = await exportPublicKeyBase64(rsaKeyPair.publicKey);

      console.log(
        `%c🔐 [RSA]%c Par gerado. Chave pública SPKI (${clientPublicKeyRSA.length} chars) pronta.`,
        LOG_STYLES.rsa, ''
      );

      // ══════════════════════════════════════════════════════════════════════
      // STAGE 4 — ENVELOPE AES-GCM(DH) carregando a chave pública RSA
      // Rota /api/oauth/r: servidor decifra AES-GCM, importa RSA public key,
      //                    cifra um challenge com RSA-OAEP e devolve.
      // ══════════════════════════════════════════════════════════════════════
      const rawPayloadR = {
        id_prospect:       sessionState.data.id_prospect,
        clientPublicKeyRSA,
        intent:            'PI_NETWORK_OAUTH_AUTHORIZATION',
        ts:                Date.now()
      };

      console.log(`%c🔒 [STAGE 4]%c Cifrando payload RSA com AES-GCM(DH)...`, LOG_STYLES.debug, '');
      const envelopeStage4: DhSignedEnvelope = await encryptJson(rawPayloadR, sharedSecret);

      this.oauthContext.setOperation(OAuthTag.VOID);
      const serverResponse = await this.orchestrator.executeAssignment(envelopeStage4);

      console.log(`%c📥 [STAGE 4 RES]%c Passaporte recebido de "/r":`, 'color: #10b981', serverResponse);

      // ══════════════════════════════════════════════════════════════════════
      // STAGE 4.5 — DECIFRAGEM DO CHALLENGE RSA-OAEP
      // O servidor cifrou um challenge com a public key RSA do cliente.
      // Só quem tem a private key consegue decifrar — prova de posse.
      // ══════════════════════════════════════════════════════════════════════
      const rsaEncryptedChallenge: string | undefined =
        serverResponse?.rsaEncryptedChallenge ?? serverResponse?.data?.rsaEncryptedChallenge;

      if (!rsaEncryptedChallenge) {
        throw new AppError(
          'Challenge RSA-OAEP ausente na resposta de "/r": servidor não selou o canal.',
          'AUTH_ERROR'
        );
      }

      console.log(`%c🔓 [RSA]%c Decifrando challenge RSA-OAEP com a private key local...`, LOG_STYLES.rsa, '');
      const rsaProof = await decryptRsaChallenge(rsaEncryptedChallenge, rsaKeyPair.privateKey);

      console.log(
        `%c✅ [RSA]%c Challenge decifrado. Canal RSA-OAEP confirmado. Prova de posse estabelecida.`,
        LOG_STYLES.rsa, ''
      );

      // ══════════════════════════════════════════════════════════════════════
      // STAGE 5 — AUTENTICAÇÃO PI NETWORK SDK
      //
      // Estratégia de resiliência:
      //   1. Detecta se o SDK inicializou com sucesso (window.__piSdkReady)
      //   2. Detecta se está no Pi Browser via userAgent
      //   3. Chama authenticate() com timeout de 12s para não travar
      //   4. Qualquer erro (AxiosError, timeout, SDK ausente) → AuthModel mock
      //      sem propagar exceção — o fluxo continua normalmente
      // ══════════════════════════════════════════════════════════════════════
      const scopes = ['username', 'payments'];
      let piAuthResult: AuthModel;

      const piSdkReady: boolean =
        !!(window as any).__piSdkReady &&
        typeof (window as any).Pi?.authenticate === 'function';

      const inPiBrowser: boolean =
        /PiBrowser/i.test(navigator.userAgent);

      console.log(
        `%c🛡️ [PI SDK]%c SDK pronto: ${piSdkReady} | Pi Browser: ${inPiBrowser}`,
        LOG_STYLES.payload, ''
      );

      if (!piSdkReady) {
        // SDK não carregou ou falhou no init — vai direto pro mock
        console.warn('[Pi SDK] SDK não está pronto. Usando AuthModel de desenvolvimento.');
        piAuthResult = new AuthModel({
          accessToken: 'dev_token_sdk_unavailable_' + Date.now(),
          user: { uid: 'dev-uid-prismo', username: 'dev_prospect_pi' }
        });
      } else {
        // SDK disponível — chama authenticate() com timeout de segurança
        const PI_SDK_TIMEOUT_MS = 12_000;

        const sdkCall = (): Promise<any> =>
          new Promise((resolve, reject) => {
            window.Pi.authenticate(
              scopes,
              (payment: any) => {
                // Callback de pagamento incompleto — tratado silenciosamente
                console.warn('[Pi SDK] Pagamento incompleto detectado:', payment?.identifier);
              }
            )
            .then(resolve)
            .catch(reject);
          });

        const timeout = (): Promise<never> =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Pi SDK timeout após ${PI_SDK_TIMEOUT_MS}ms`)), PI_SDK_TIMEOUT_MS)
          );

        try {
          const rawAuth = await Promise.race([sdkCall(), timeout()]);
          piAuthResult = new AuthModel(rawAuth);
          console.log(`%c✅ [PI SDK]%c Autenticação bem-sucedida via SDK real.`, LOG_STYLES.success, '');
        } catch (sdkError: any) {
          // Suprime AxiosError e qualquer falha do SDK — fallback transparente
          const reason = sdkError?.name === 'AxiosError'
            ? `AxiosError (${sdkError.response?.status ?? 'sem resposta'}) — fora do Pi Browser`
            : sdkError?.message ?? 'erro desconhecido';

          console.warn(`[Pi SDK] Falha capturada: ${reason}. Usando AuthModel de desenvolvimento.`);
          piAuthResult = new AuthModel({
            accessToken: 'dev_token_sdk_fallback_' + Date.now(),
            user: { uid: 'dev-uid-prismo', username: 'dev_prospect_pi' }
          });
        }
      }

      console.log(
        `%c👤 [PI SDK]%c AuthModel: [válido: ${piAuthResult.isValid()} | user: ${piAuthResult.user.username}]`,
        'color: #10b981', piAuthResult
      );

      // ══════════════════════════════════════════════════════════════════════
      // STAGE 6 — PAYLOAD SELADO PELAS DUAS CRIPTOGRAFIAS
      //
      // Camada 1 (DH): AES-GCM(sharedSecret) → envelopa tudo
      // Camada 2 (RSA): rsaProof = challenge decifrado com private key RSA
      //                 → prova ao servidor que o cliente é dono da chave RSA
      //
      // O servidor valida ambas:
      //   1. Decifra AES-GCM(DH)  → abre o envelope
      //   2. Verifica rsaProof    → confirma posse da private key RSA
      //   Só então aceita os dados da Pi Network.
      // ══════════════════════════════════════════════════════════════════════
      const rawStage6 = {
        serverSessionRef: serverResponse.serverSessionRef ?? serverResponse.data ?? serverResponse,
        piAuthData: {
          accessToken: piAuthResult.accessToken,
          user:        piAuthResult.user
        },
        rsaProof,     // Challenge decifrado com RSA private key — Camada 2
        ts:           Date.now()
      };

      console.log(`%c🔒 [STAGE 6]%c Selando payload Pi Network com AES-GCM(DH) + RSA proof...`, LOG_STYLES.debug, '');
      const envelopeStage6: DhSignedEnvelope = await encryptJson(rawStage6, sharedSecret);

      console.log(
        `%c🔐 [STAGE 6]%c Payload duplamente selado. IV AES: ${envelopeStage6.iv.slice(0, 8)}... | RSA proof: ${rsaProof.slice(0, 8)}...`,
        LOG_STYLES.crypto, ''
      );

      this.oauthContext.setOperation(OAuthTag.OAUTH);
      const serverFinalResponse = await this.orchestrator.executeAssignment(envelopeStage6);

      console.log(`%c📥 [STAGE 6 RES]%c Resposta final recebida:`, 'color: #10b981', serverFinalResponse);

      // ── Finalização ──────────────────────────────────────────────────────
      console.log(
        `%c🚀 [SUCCESS]%c Integração Pi Network selada. AES-GCM(DH) ✅  RSA-OAEP ✅`,
        LOG_STYLES.success, ''
      );

      this.oauthContext.setOAuthData(
        serverFinalResponse.data || serverFinalResponse,
        serverFinalResponse.permission || null
      );

      return serverFinalResponse;

    } catch (error) {
      this.handleExecutionError(error);
    } finally {
      if (this.errorTracker.hasErrors) {
        this.oauthContext.setOperation(OAuthTag.VOID);
      }
    }
  }

  private handleExecutionError(err: any): void {
    let appError: AppError;

    if (err instanceof AppError) {
      appError = err;
    } else {
      const msg = err?.error?.error || err?.message || 'Falha crítica na esteira OAuth';
      appError = new AppError(msg, 'CLIENT_ERROR', err?.status || 500, { rawError: err });
    }

    console.error(`%c❌ [CRITICAL]%c ${appError.message}`, LOG_STYLES.error, '');
    this.errorTracker.add(appError);
    throw appError;
  }
}
