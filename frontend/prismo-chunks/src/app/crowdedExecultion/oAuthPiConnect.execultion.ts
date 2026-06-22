/// <reference path="../../types/pi-network.d.ts" />
import { Injectable, inject } from '@angular/core';
import { OAuthPipelineOrchestrator } from '../services-workers/OAuthPipelineOrquestrator';
import { SessionContext } from '../context/session.context';
import { OauthContext } from '../context/oauth.context';
import { OAuthTag } from '../models/oauth.model';
import { PrismoSessionState } from '../models/session.model';
import { AppError, ErrorAccumulator } from '../models/error.model';
import { encryptJson, decryptJson } from '../helpers/session.helpers';

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
      // STAGE 5 — EXTRAÇÃO DO TOKEN INTERNO DA MUTAÇÃO / HANDSHAKE EXPÍCITO
      // ══════════════════════════════════════════════════════════════════════
      const scopes = ['username', 'payments', 'wallet_address'];
      let piAuthResult: AuthModel;

      console.log('%c🔍 [DEBUG REAL-TIME] Analisando sub-estruturas de window.Pi:', LOG_STYLES.debug);
      console.dir(window.Pi);

      const piInstance = window.Pi as any;

      let isSdkInitialized = !!window.__piSdkReady;
      if (piInstance && typeof piInstance.checkInitialized === 'function') {
        try { isSdkInitialized = piInstance.checkInitialized() || isSdkInitialized; } catch (e) {}
      }

      const hasPiObject = typeof window.Pi !== 'undefined' && window.Pi !== null;

      // Busca o token ativo de forma profunda nos locais apontados pela mutação do objeto
      const extractedToken: string | null = 
        piInstance?.accessToken || 
        piInstance?.api?.accessToken || 
        piInstance?.Wallet?.api?.accessToken || 
        null;

      // Se já temos um token real na janela (usuário já deu consentimento prévio nesta sessão)
      const hasImplicitAuth = !!(extractedToken && extractedToken !== 'implicit_active_token');

      console.log(
        `%c🛡️ [PI SDK]%c Inicializado: ${isSdkInitialized} | Token Presente na Janela: ${!!extractedToken} | PiBrowser Ativo: ${hasPiObject}`,
        LOG_STYLES.payload, ''
      );

      // CASO 5.A: O Token já existe de forma implícita no objeto global. Ignora handshake redundante para evitar rejeição do Sandbox!
      if (hasPiObject && hasImplicitAuth) {
        console.log(`%c✅ [PI SDK]%c Token já ativo detectado na janela. Ignorando handshake redundante para evitar erros de Sandbox.`, LOG_STYLES.success, '');
        piAuthResult = new AuthModel({
          accessToken: extractedToken,
          user: { 
            uid: piInstance?.user?.uid || piInstance?.api?.user?.uid || 'pi-uid-implicit', 
            username: piInstance?.user?.username || piInstance?.api?.user?.username || 'pi_user_implicit' 
          }
        });
      }
      // CASO 5.B: Fora do ambiente Pi Browser (Ambiente de Desenvolvimento convencional externo)
      else if (!isSdkInitialized && !hasPiObject) {
        console.warn('[Pi SDK] SDK indisponível na Janela. Aplicando fallback de simulação local.');
        piAuthResult = new AuthModel({
          accessToken: '3E8Cy9Rd1KKD_KndoO9xL02fuifkimVkb1p-WoebRpk' + Date.now(),
          user: { uid: 'dev-uid-prismo', username: 'dev_prospect_pi' }
        });
      } 
      // CASO 5.C: Dentro do Pi Browser mas precisa forçar o login (Primeiro acesso ou token limpo)
      else {
        const PI_SDK_TIMEOUT_MS = 25_000;

        console.log(`%c⚡ [PI SDK]%c Invoca authenticate() para escopos novos: ${scopes.join(', ')}`, LOG_STYLES.debug, '');

        const sdkCall = (): Promise<any> =>
          new Promise((resolve, reject) => {
            try {
              window.Pi.authenticate(
                scopes,
                (payment: any) => {
                  console.warn('%c[Pi SDK] ⚠️ Transação pendente interceptada no fluxo de Auth:', LOG_STYLES.debug, payment?.identifier);
                }
              )
              .then((authResponse: any) => {
                console.log('%c📥 [PI SDK HANDSHAKE SUCCESS]%c Consentimento homologado:', LOG_STYLES.success, authResponse);
                resolve(authResponse);
              })
              .catch((err: any) => {
                reject(err);
              });
            } catch (fatalError) {
              reject(fatalError);
            }
          });

        const timeout = (): Promise<never> =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Pi SDK timeout esperando interação no modal`)), PI_SDK_TIMEOUT_MS)
          );

        try {
          const rawAuth = await Promise.race([sdkCall(), timeout()]);
          if (!rawAuth || !rawAuth.accessToken) throw new Error("Resposta vazia do handshake.");

          piAuthResult = new AuthModel(rawAuth);
          console.log(`%c✅ [PI SDK]%c Autenticação homologada via handshake assíncrono.`, LOG_STYLES.success, '');
        } catch (sdkError: any) {
          console.warn(`%c⚠️ [PI SDK CATCH]%c Handshake rejeitado ou erro fantasma do Sandbox. Verificando mutação residual...`, LOG_STYLES.debug, '');

          // PLANO DE CONTINGÊNCIA: Se deu o erro que você capturou, mas o token real está lá, nós salvamos a operação
          const recoveryToken = piInstance?.accessToken || piInstance?.api?.accessToken || piInstance?.Wallet?.api?.accessToken;

          if (recoveryToken) {
            console.log(`%c🛡️ [RECOVERY SUCCESS]%c Ignorando erro do SDK; Token verídico extraído com sucesso pós-consentimento!`, LOG_STYLES.success, '');
            piAuthResult = new AuthModel({
              accessToken: recoveryToken,
              user: { 
                uid: piInstance?.user?.uid || piInstance?.api?.user?.uid || 'pi-uid-recovered', 
                username: piInstance?.user?.username || piInstance?.api?.user?.username || 'pi_user_recovered' 
              }
            });
          } else {
            throw new AppError(`Falha de autenticação real no ecossistema Pi: ${sdkError?.message || 'Authentication failed'}`, 'AUTH_ERROR');
          }
        }
      }



      


                  
      

      // ══════════════════════════════════════════════════════════════════════
      // STAGE 6 — DOUBLE-SEALED ENVELOPE (VALIDAÇÃO & CIFRAGEM)
      // ══════════════════════════════════════════════════════════════════════
      const tokenToValidate = piAuthResult.accessToken;
      const previewToken = tokenToValidate 
        ? `${tokenToValidate.substring(0, 10)}... [Tamanho: ${tokenToValidate.length}]` 
        : '⚠️ NULO/VAZIO';

      if (!tokenToValidate || tokenToValidate.includes('fallback') || tokenToValidate.startsWith('3E8Cy9Rd1')) {
        console.log(
          `%c⚠️ [PI-TRACK] CUIDADO %c O token atual é um MOCK ou AMBIENTE DE DEV: "${previewToken}"`,
          'background: #f59e0b; color: #000; font-weight: bold; padding: 2px 6px; border-radius: 3px;',
          'color: #f59e0b;'
        );
      } else {
        console.log(
          `%c🚀 [PI-TRACK] CAPTURADO %c Pronto para envelopar. Token Real: %c"${previewToken}"`,
          'background: #10b981; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 3px;',
          'color: #fff;',
          'color: #3b82f6; font-family: monospace; font-weight: bold;'
        );
      }

      console.log(`%c📦 [PI-TRACK PAYLOAD]%c Estrutura de autenticação consolidada:`, LOG_STYLES.payload);
      console.table({
        id_prospect: sessionState.data.id_prospect,
        token_preview: previewToken,
        uid: piAuthResult.user.uid || 'NULO',
        username: piAuthResult.user.username || 'NULO',
        rsa_proof_length: rsaProof?.length || 0
      });

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
