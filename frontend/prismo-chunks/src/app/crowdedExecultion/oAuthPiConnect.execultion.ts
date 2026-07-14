import { Injectable, inject } from '@angular/core';
import { OAuthPipelineOrchestrator } from '../services-workers/OAuthPipelineOrquestrator';
import { SessionContext } from '../context/session.context';
import { OauthContext } from '../context/oauth.context';
import { OAuthTag } from '../models/oauth.model';
import { PrismoSessionState } from '../models/session.model';
import { AppError, ErrorAccumulator } from '../models/error.model';
import { encryptJson, decryptJson } from '../helpers/session.helpers';
// Fonte única da verdade: Importa a infra estruturada limpa do SDK e o tipo do usuário
import { PiSdkBase, PiUser } from '../../base/PiSDK.base'; 

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
      // STAGE 5 — EXECUÇÃO DO HANDSHAKE VIA INSTÂNCIA CENTRAL (PADRÃO PI SDK)
      // ══════════════════════════════════════════════════════════════════════
      const piInstance = window.Pi;
      const hasPiObject = typeof piInstance !== 'undefined' && piInstance !== null;

      // Inicia a instância limpa e consome o método de conexão unificado
      const pi = new PiSdkBase();

      let tokenPayload: string | null = null;
      let userPayload: PiUser | null = null;

      try {
        // 1. Abre o gatekeeper alterando para SDK_PROFILE de forma síncrona antes do await
        this.oauthContext.setOperation(OAuthTag.SDK_PROFILE);
        console.log(`%c🔄 [GATEKEEPER]%c Contexto chaveado para SDK_PROFILE para liberar rotas internas.`, LOG_STYLES.debug, '');

        console.log(`%c⚡ [PI SDK]%c Disparando pipeline de conexão da instância...`, LOG_STYLES.debug, '');
        await pi.connect();
        
        // 2. Chaveia para SDK_TRACK imediatamente após o término do connect
        this.oauthContext.setOperation(OAuthTag.SDK_TRACK);
        console.log(`%c🔄 [GATEKEEPER]%c Contexto chaveado para SDK_TRACK após resolução do handshake.`, LOG_STYLES.debug, '');

        tokenPayload = PiSdkBase.accessToken;
        userPayload = PiSdkBase.user;

      } catch (sdkError: any) {
        if (!hasPiObject) {
          console.warn('[Pi SDK] Fora do ambiente nativo. Injetando credenciais mockadas de desenvolvimento.');
          tokenPayload = '3E8Cy9Rd1KKD_KndoO9xL02fuifkimVkb1p-WoebRpk' + Date.now();
          userPayload = { uid: 'dev-uid-prismo', name: 'dev_prospect_pi' };
        } else {
          throw new AppError(`Falha de autenticação real no ecossistema Pi: ${sdkError?.message || 'Authentication failed'}`, 'AUTH_ERROR');
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // STAGE 6 — DOUBLE-SEALED ENVELOPE (VALIDAÇÃO & CIFRAGEM)
      // ══════════════════════════════════════════════════════════════════════
      const previewToken = tokenPayload 
        ? `${tokenPayload.substring(0, 10)}... [Tamanho: ${tokenPayload.length}]` 
        : '⚠️ NULO/VAZIO';

      if (!tokenPayload || tokenPayload.startsWith('3E8Cy9Rd1')) {
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
        uid: userPayload?.uid || 'NULO',
        username: userPayload?.name || 'NULO',
        rsa_proof_length: rsaProof?.length || 0
      });

      const rawStage6 = {
        serverSessionRef: serverResponse.serverSessionRef ?? serverResponse.data ?? serverResponse,
        piAuthData: {
          accessToken: tokenPayload,
          user: userPayload ? { uid: userPayload.uid, username: userPayload.name } : null
        },
        rsaProof,
        ts:           Date.now()
      };

      console.log(`%c🔒 [STAGE 6]%c Selando payload final com AES-GCM(DH) + RSA...`, LOG_STYLES.debug, '');
      const envelopeStage6: DhSignedEnvelope = await encryptJson(rawStage6, sharedSecret);

      // 3. Libera o pipeline final para despachar a payload assinada para o backend
      this.oauthContext.setOperation(OAuthTag.OAUTH);
      console.log(`%c🔄 [GATEKEEPER]%c Contexto chaveado para OAUTH para submissão do envelope final.`, LOG_STYLES.crypto, '');

      const encryptedFinal = await this.orchestrator.executeAssignment(envelopeStage6);
      console.log(`%c🔓 [STAGE 6 RES]%c Decifrando resposta cifrada de "/PiOAuth"...`, LOG_STYLES.crypto, '');
      const serverFinalResponse = await decryptJson(encryptedFinal, sharedSecret);
      console.log(`%c📥 [STAGE 6 RES]%c Identidade Pi Network decifrada:`, 'color: #10b981', serverFinalResponse);

      console.log(
        `%c🚀 [SUCCESS]%c Canal selado: AES-GCM(DH) ✅  RSA-OAEP ✅  Pi Platform ✅`,
        LOG_STYLES.success, ''
      );

      // Mapeamento defensivo da estrutura da resposta para garantir o preenchimento de 'data' e 'permition'
      const finalOAuthData = serverFinalResponse?.identity   ?? serverFinalResponse?.data?.identity   ?? serverFinalResponse;
      const finalPermition = serverFinalResponse?.permission ?? serverFinalResponse?.data?.permission ?? null;

      this.oauthContext.setOAuthData(finalOAuthData, finalPermition);

      // 🔍 PRINT DE DIAGNÓSTICO DO ESTADO DO CONTEXTO DO OAUTH
      console.log('%c⚙️ [CONTEXT VERIFICATION]%c Estado atualizado pós-handshake:', 'background: #2563eb; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 3px;', '');
      console.log({
        tagAtiva: this.oauthContext.currentState.tag,
        dadosUsuario: this.oauthContext.currentState.data,
        permissoesValidadas: this.oauthContext.currentState.permition
      });

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
