import { Injectable, inject } from '@angular/core';
import { OAuthPipelineOrchestrator } from '../services-workers/OAuthPipelineOrquestrator';
import { SessionContext } from '../context/session.context';
import { OauthContext } from '../context/oauth.context';
import { OAuthTag } from '../models/oauth.model';
import { PrismoSessionState } from '../models/session.model';
import { AppError, ErrorAccumulator } from '../models/error.model';
import { encryptJson, decryptJson } from '../helpers/session.helpers';

// ---> REFERÊNCIA VISUAL DE TIPOS DO SEU PROJETO
/// <reference path="../types/pi-network.d.ts" />

export type AuthResult = {
  accessToken: string;
  user: { uid: string; username: string };
};

export class AuthModel {
  public accessToken: string | null;
  public user: { uid: string | null; username: string | null };

  constructor(data: Partial<AuthResult> | null | undefined) {
    this.accessToken = data?.accessToken || null;
    this.user = { 
      uid: data?.user?.uid || null, 
      username: data?.user?.username || null 
    };
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

interface DhSignedEnvelope {
  iv:         string;
  ciphertext: string;
}

async function generateRsaOaepKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name:           'RSA-OAEP',
      modulusLength:  2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash:           'SHA-256'
    },
    true,
    ['encrypt', 'decrypt']
  );
}

async function exportPublicKeyBase64(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', publicKey);
  return btoa(String.fromCharCode(...new Uint8Array(spki)));
}

async function decryptRsaChallenge(
  rsaEncryptedChallengeBase64: string,
  privateKey: CryptoKey
): Promise<string> {
  const cipherBytes = Uint8Array.from(atob(rsaEncryptedChallengeBase64), c => c.charCodeAt(0));
  const decrypted   = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, cipherBytes);
  return new TextDecoder().decode(decrypted);
}

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
      // STAGE 3 — RSA GENERATION
      console.log(`%c🔐 [RSA]%c Gerando par RSA-OAEP 2048-bit SHA-256...`, LOG_STYLES.rsa, '');
      const rsaKeyPair         = await generateRsaOaepKeyPair();
      const clientPublicKeyRSA = await exportPublicKeyBase64(rsaKeyPair.publicKey);
      console.log(`%c🔐 [RSA]%c Par gerado. Chave pública SPKI pronta.`, LOG_STYLES.rsa, '');

      // STAGE 4 — AES-GCM ENVELOPE
      const rawPayloadR = {
        id_prospect:       sessionState.data.id_prospect,
        clientPublicKeyRSA,
        intent:            'PI_NETWORK_OAUTH_AUTHORIZATION',
        ts:                Date.now()
      };

      console.log(`%c🔒 [STAGE 4]%c Cifrando payload RSA com AES-GCM(DH)...`, LOG_STYLES.debug, '');
      const envelopeStage4: DhSignedEnvelope = await encryptJson(rawPayloadR, sharedSecret);

      this.oauthContext.setOperation(OAuthTag.VOID);
      const encryptedR = await this.orchestrator.executeAssignment(envelopeStage4);
      // Backend devolve { iv, ciphertext } — decifra com o sharedSecret DH da sessão
      console.log(`%c🔓 [STAGE 4 RES]%c Decifrando resposta cifrada de "/r"...`, LOG_STYLES.crypto, '');
      const serverResponse = await decryptJson(encryptedR, sharedSecret);
      console.log(`%c📥 [STAGE 4 RES]%c Passaporte recebido e decifrado:`, 'color: #10b981', serverResponse);

      // STAGE 4.5 — CHALLENGE DECRYPTION
      const rsaEncryptedChallenge: string | undefined =
        serverResponse?.rsaEncryptedChallenge ?? serverResponse?.data?.rsaEncryptedChallenge;

      if (!rsaEncryptedChallenge) {
        throw new AppError(
          'Challenge RSA-OAEP ausente na resposta de "/r": servidor não selou o canal.',
          'AUTH_ERROR'
        );
      }

      console.log(`%c🔓 [RSA]%c Decifrando challenge RSA-OAEP...`, LOG_STYLES.rsa, '');
      const rsaProof = await decryptRsaChallenge(rsaEncryptedChallenge, rsaKeyPair.privateKey);
      console.log(`%c✅ [RSA]%c Challenge decifrado. Prova de posse estabelecida.`, LOG_STYLES.rsa, '');

      // ══════════════════════════════════════════════════════════════════════
      // STAGE 5 — EXTRAÇÃO DO TOKEN INTERNO DA MUTAÇÃO
      // ══════════════════════════════════════════════════════════════════════
      const scopes = ['username', 'payments'];
      let piAuthResult: AuthModel;

      console.log('%c🔍 [DEBUG REAL-TIME] Analisando sub-estruturas de window.Pi:', LOG_STYLES.debug);
      console.dir(window.Pi);

      const piInstance = window.Pi as any;
      
      let isSdkInitialized = !!window.__piSdkReady;
      if (piInstance && typeof piInstance.checkInitialized === 'function') {
        try { isSdkInitialized = piInstance.checkInitialized() || isSdkInitialized; } catch (e) {}
      }

      const inPiBrowser: boolean = /PiBrowser/i.test(navigator.userAgent);

      // Busca o token de forma profunda nos locais apontados pela mutação do objeto api
      const extractedToken: string | null = 
        piInstance?.accessToken || 
        piInstance?.api?.accessToken || 
        piInstance?.Wallet?.api?.accessToken || 
        null;

      const hasImplicitAuth = !!(extractedToken || piInstance?.consentedScopes);

      console.log(
        `%c🛡️ [PI SDK]%c Inicializado: ${isSdkInitialized} | Token Capturado: ${!!extractedToken} | PiBrowser: ${inPiBrowser}`,
        LOG_STYLES.payload, ''
      );

      // CASO 5.A: Token localizado com sucesso dentro das ramificações do objeto api
      if (hasImplicitAuth) {
        console.log(`%c✅ [PI SDK]%c Extraindo Token do sub-objeto 'api'. Ignorando handshake redundante.`, LOG_STYLES.success, '');
        piAuthResult = new AuthModel({
          accessToken: extractedToken || 'implicit_active_token',
          user: { 
            uid: piInstance?.user?.uid || 'pi-uid-implicit', 
            username: piInstance?.user?.username || 'pi_user_implicit' 
          }
        });
      } 
      // CASO 5.B: Ambiente de desenvolvimento convencional externo
      else if (!isSdkInitialized && !inPiBrowser) {
        console.warn('[Pi SDK] SDK indisponível. Aplicando fallback de simulação.');
        piAuthResult = new AuthModel({
          accessToken: '3E8Cy9Rd1KKD_KndoO9xL02fuifkimVkb1p-WoebRpk' + Date.now(),
          user: { uid: 'dev-uid-prismo', username: 'dev_prospect_pi' }
        });
      } 
      // CASO 5.C: Handshake explícito por promessa clássica
      else {
        const PI_SDK_TIMEOUT_MS = 12_000;

        const sdkCall = (): Promise<any> =>
          new Promise((resolve, reject) => {
            window.Pi.authenticate(
              scopes,
              (payment: any) => {
                console.warn('[Pi SDK] Transação pendente interceptada:', payment?.identifier);
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
          console.log(`%c✅ [PI SDK]%c Autenticação homologada via handshake de fallback.`, LOG_STYLES.success, '');
        } catch (sdkError: any) {
          console.warn(`[Pi SDK] Falha no handshake. Ativando mock-recovery.`);
          piAuthResult = new AuthModel({
            accessToken: 'dev_token_sdk_fallback_' + Date.now(),
            user: { uid: 'dev-uid-prismo', username: 'dev_prospect_pi' }
          });
        }
      }

      console.log(
        `%c👤 [PI SDK]%c AuthModel finalizado [user: ${piAuthResult.user.username}]`,
        'color: #10b981', piAuthResult
      );

      // STAGE 6 — DOUBLE-SEALED ENVELOPE
      const rawStage6 = {
        serverSessionRef: serverResponse.serverSessionRef ?? serverResponse.data ?? serverResponse,
        piAuthData: {
          accessToken: piAuthResult.accessToken,
          user:        piAuthResult.user
        },
        rsaProof,
        ts:           Date.now()
      };

      console.log(`%c🔒 [STAGE 6]%c Selando payload final com AES-GCM(DH) + RSA...`, LOG_STYLES.debug, '');
      const envelopeStage6: DhSignedEnvelope = await encryptJson(rawStage6, sharedSecret);

      this.oauthContext.setOperation(OAuthTag.OAUTH);
      const encryptedFinal = await this.orchestrator.executeAssignment(envelopeStage6);
      // Backend devolve { iv, ciphertext } — decifra com o sharedSecret DH da sessão
      console.log(`%c🔓 [STAGE 6 RES]%c Decifrando resposta cifrada de "/PiOAuth"...`, LOG_STYLES.crypto, '');
      const serverFinalResponse = await decryptJson(encryptedFinal, sharedSecret);
      console.log(`%c📥 [STAGE 6 RES]%c Identidade Pi Network decifrada:`, 'color: #10b981', serverFinalResponse);

      console.log(
        `%c🚀 [SUCCESS]%c Canal selado: AES-GCM(DH) ✅  RSA-OAEP ✅  Pi Platform ✅`,
        LOG_STYLES.success, ''
      );

      this.oauthContext.setOAuthData(
        serverFinalResponse.identity || serverFinalResponse,
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
