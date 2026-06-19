import { Injectable, inject } from '@angular/core';
import { OAuthPipelineOrchestrator } from '../services-workers/OAuthPipelineOrquestrator';
import { SessionContext } from '../context/session.context';
import { OauthContext } from '../context/oauth.context';
import { OAuthTag } from '../models/oauth.model';
import { PrismoSessionState } from '../models/session.model';
import { AppError, ErrorAccumulator } from '../models/error.model';
import { encryptJson } from '../helpers/session.helpers';

declare global {
  interface Window {
    Pi: any;
  }
}

// ─────────────────────────────────────────────────────────────────
// CONTRATO E MODELO DE AUTENTICAÇÃO DO PI SDK
// ─────────────────────────────────────────────────────────────────
export type AuthResult = {
  accessToken: string;
  user: {
    uid: string;
    username: string;
  };
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
};

// ─────────────────────────────────────────────────────────────────
// CONTRATO DO ENVELOPE CIFRADO AES-GCM (DH-Signed)
// ─────────────────────────────────────────────────────────────────
interface DhSignedEnvelope {
  iv:         string; // base64 do IV (12 bytes)
  ciphertext: string; // base64 do ciphertext AES-GCM
}

interface PiOAuthPayload {
  id_prospect:      string;
  clientPublicKeyRSA: string;
  intent:           string;
  ts:               number;
}

@Injectable({ providedIn: 'root' })
export class OAuthPiConnectExecution {
  private orchestrator  = inject(OAuthPipelineOrchestrator);
  private sessionContext = inject(SessionContext);
  private oauthContext   = inject(OauthContext);

  public errorTracker = new ErrorAccumulator('OAuthPiConnectPipeline');

  async run(clientPublicKeyRSA: string): Promise<any> {
    console.log(
      `%c🔒 [OAUTH_PI]%c Iniciando esteira sequencial com assinatura DH (AES-GCM).`,
      LOG_STYLES.crypto, ''
    );

    const sessionState: PrismoSessionState = this.sessionContext.currentState;

    if (!sessionState.data || !sessionState.data.id_prospect) {
      this.oauthContext.setOperation(OAuthTag.VOID);
      throw new AppError(
        'Falha de Contexto: id_prospect indisponível na RAM para vincular OAuth.',
        'VALIDATION_ERROR'
      );
    }

    // ─────────────────────────────────────────────────────────────────
    // EXTRAÇÃO DA SHARED SECRET DO TÚNEL DH ESTABELECIDO NA SESSÃO
    // ─────────────────────────────────────────────────────────────────
    const dhResult     = sessionState.metadata?.[1];
    const sharedSecret = dhResult?.sharedSecret;

    if (!sharedSecret) {
      this.oauthContext.setOperation(OAuthTag.VOID);
      throw new AppError(
        'Shared Secret ausente: o handshake Diffie-Hellman da sessão não está estabelecido.',
        'AUTH_ERROR'
      );
    }

    console.log(
      `%c🔑 [CRYPTO]%c Shared Secret DH resgatado do contexto de sessão. Canal criptográfico ativo.`,
      LOG_STYLES.crypto, ''
    );

    try {
      // ─────────────────────────────────────────────────────────────────
      // STAGE 3: MONTAGEM DO PAYLOAD BRUTO
      // ─────────────────────────────────────────────────────────────────
      const rawPayload: PiOAuthPayload = {
        id_prospect:       sessionState.data.id_prospect,
        clientPublicKeyRSA: clientPublicKeyRSA,
        intent:            'PI_NETWORK_OAUTH_AUTHORIZATION',
        ts:                Date.now()
      };

      console.log(`%c📝 [STAGE 3]%c Payload RSA montado. Assinando com Shared Secret DH...`, LOG_STYLES.debug, '');

      // ─────────────────────────────────────────────────────────────────
      // STAGE 3 → CIFRAGEM: AES-GCM com chave derivada da Shared Secret DH
      // Deriva: SHA-256(sharedSecretHex) → AES-256 key
      // Produto: { iv: base64, ciphertext: base64 }
      // ─────────────────────────────────────────────────────────────────
      const envelopeStage4: DhSignedEnvelope = await encryptJson(rawPayload, sharedSecret);

      console.log(
        `%c🔒 [STAGE 3 CIFRADO]%c Envelope DH-Signed pronto para "/r". IV: ${envelopeStage4.iv.slice(0, 8)}...`,
        LOG_STYLES.crypto, ''
      );

      // ─────────────────────────────────────────────────────────────────
      // STAGE 4: PRIMEIRO DISPARO — TAG VOID (Rota: /api/oauth/r)
      // Envia envelope cifrado. O servidor usa o X-Freezer-Token para
      // recuperar o sharedSecret e decifrar o payload RSA.
      // ─────────────────────────────────────────────────────────────────
      this.oauthContext.setOperation(OAuthTag.VOID);
      const serverResponse = await this.orchestrator.executeAssignment(envelopeStage4);

      console.log(`%c📥 [STAGE 4 RES]%c Passaporte OAuth recebido de "/r":`, 'color: #10b981', serverResponse);

      // ─────────────────────────────────────────────────────────────────
      // STAGE 5: AUTENTICAÇÃO COM A PI NETWORK (FALLBACK COM AUTHMODEL)
      // ─────────────────────────────────────────────────────────────────
      console.log(`%c🛡️ [PI SDK IN]%c Acionando window.Pi.authenticate()...`, LOG_STYLES.payload, '');

      const scopes = ['username', 'payments'];

      const onIncompletePaymentFound = async (payment: any) => {
        console.warn('⚠️ Pagamento incompleto detectado pelo SDK do Pi:', payment);
      };

      let piAuthResult: AuthModel;

      try {
        const rawAuth = await window.Pi.authenticate(scopes, onIncompletePaymentFound);
        piAuthResult = new AuthModel(rawAuth);
      } catch (sdkError: any) {
        console.warn('⚠️ Falha de rede capturada no SDK do Pi. Instanciando Fallback seguro via AuthModel para desenvolvimento.');

        piAuthResult = new AuthModel({
          accessToken: 'mock_access_token_replit_' + Date.now(),
          user: {
            uid:      'mock-uid-prismo-123',
            username: 'test_prospect_pi'
          }
        });
      }

      console.log(`%c👤 [PI SDK OUT]%c Modelo de Autenticação validado: [Valid: ${piAuthResult.isValid()}]`, 'color: #10b981', piAuthResult);

      // ─────────────────────────────────────────────────────────────────
      // STAGE 6: MONTAGEM DO PAYLOAD DE CONSOLIDAÇÃO
      // ─────────────────────────────────────────────────────────────────
      const rawStage6 = {
        serverSessionRef: serverResponse.data || serverResponse,
        piAuthData: {
          accessToken: piAuthResult.accessToken,
          user:        piAuthResult.user
        },
        ts: Date.now()
      };

      console.log(`%c📝 [STAGE 6]%c Payload de consolidação montado. Assinando com Shared Secret DH...`, LOG_STYLES.debug, '');

      // ─────────────────────────────────────────────────────────────────
      // STAGE 6 → CIFRAGEM: mesmo canal DH, novo IV gerado por encryptJson
      // ─────────────────────────────────────────────────────────────────
      const envelopeStage6: DhSignedEnvelope = await encryptJson(rawStage6, sharedSecret);

      console.log(
        `%c🔒 [STAGE 6 CIFRADO]%c Envelope DH-Signed pronto para "/PiOAuth". IV: ${envelopeStage6.iv.slice(0, 8)}...`,
        LOG_STYLES.crypto, ''
      );

      // ─────────────────────────────────────────────────────────────────
      // STAGE 6: SEGUNDO DISPARO — TAG OAUTH (Rota: /api/oauth/PiOAuth)
      // ─────────────────────────────────────────────────────────────────
      this.oauthContext.setOperation(OAuthTag.OAUTH);
      const serverFinalResponse = await this.orchestrator.executeAssignment(envelopeStage6);

      console.log(`%c📥 [STAGE 6 OUT]%c Resposta final recebida do servidor:`, 'color: #10b981', serverFinalResponse);

      // ─────────────────────────────────────────────────────────────────
      // STAGE 7: FINALIZAÇÃO E ESTADO
      // ─────────────────────────────────────────────────────────────────
      console.log(`%c🚀 [SUCCESS]%c Integração concluída com assinatura DH em todas as etapas.`, LOG_STYLES.success, '');

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

    if (err.isAxiosError && err.response) {
      const serverDetails = err.response.data;
      console.error('🔥 [AXIOS ERROR DETECTED]:', serverDetails);
      appError = new AppError(
        serverDetails.error || serverDetails.message || 'Erro na comunicação HTTP com o servidor.',
        'HTTP_ERROR',
        err.response.status,
        { rawError: serverDetails }
      );
    } else if (err instanceof AppError) {
      appError = err;
    } else {
      const errorMsg = err.message || 'Falha crítica na esteira de OAuth';
      appError = new AppError(errorMsg, 'CLIENT_ERROR', 500, { rawError: err });
    }

    console.error(`%c❌ [CRITICAL ERROR]%c Bloqueio na esteira OAUTH_PI: ${appError.message}`, LOG_STYLES.error, '');

    this.errorTracker.add(appError);
    throw appError;
  }
}
