import { Injectable, inject } from '@angular/core';
import { SessionPipelineOrchestrator } from '../services-workers/SessionPipelineOrchestrator';
import { SessionContext } from '../context/session.context';
import { SessionTag, PrismoSessionState, Session, SessionPermition, DHResult } from '../models/session.model';
import { SessionWorkerPipe } from '../pipes/session-worker.pipe';
import { SessionCacheService } from '../private/session-cache.service';
import { environment } from '../../environments/environment';

// Estilos padronizados para logs elegantes no DevTools (Alinhado com a esteira de Create)
const LOG_STYLES = {
  crypto: 'background: #3b82f6; color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  antibot: 'background: #f59e0b; color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  success: 'background: #10b981; color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  payload: 'background: #8b5cf6; color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  storage: 'background: #0d9488; color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  error: 'background: #ef4444; color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;'
};

@Injectable({ providedIn: 'root' })
export class SessionRehydrationExecution {
  private readonly STORAGE_KEY = environment.nameSessionKey;
  private readonly VAULT_PASSWORD = environment.vaultPassword;

  private orchestrator = inject(SessionPipelineOrchestrator);
  private context = inject(SessionContext);
  private cacheService = inject(SessionCacheService);

  async execute(): Promise<void> {
    console.log(
      `%c🔄 [REHYDRATE]%c Pipeline de reidratação acionado. Analisando integridade...`,
      LOG_STYLES.payload, ''
    );

    const state: PrismoSessionState = this.context.currentState;

    // Curto-circuito caso a sessão já esteja ativa na RAM
    if (state.tag === SessionTag.REST && state.data) {
      console.log(
        `%c🟢 [SHORT-CIRCUIT]%c Estado ativo em 'REST' com payload íntegro na RAM.`,
        LOG_STYLES.success, ''
      );
      return;
    }

    // Se não está em REST, fixa em PUBLIC até concluir a rota pública externa
    this.context.setOperation(SessionTag.PUBLIC);
    console.log(
      `%c🛡️ [ANTI-BOT]%c Tag de operação fixada preventivamente em: "${this.context.currentState.tag}"`,
      LOG_STYLES.antibot, ''
    );

    try {
      // ─────────────────────────────────────────────────────────────────
      // STAGE 1: INGESTÃO BRUTA
      // ─────────────────────────────────────────────────────────────────
      const rawData = sessionStorage.getItem(this.STORAGE_KEY);
      if (!rawData) {
        throw new Error(`Payload bruto não encontrado na chave: ${this.STORAGE_KEY}`);
      }
      const encrypted = JSON.parse(rawData);

      // ─────────────────────────────────────────────────────────────────
      // STAGE 2: RESOLUÇÃO DO SEGREDO (metadata[1] ou Vault)
      // ─────────────────────────────────────────────────────────────────
      // Recupera o dhResult da posição [1] da tupla metadata caso já exista na RAM
      let activeSecret: string | undefined = state.metadata ? state.metadata[1]?.sharedSecret : undefined;
      let cachedPermissions: SessionPermition | null = null;
      let vaultDhResult: DHResult | null = null;

      if (!activeSecret) {
        const vaultData = this.cacheService.recoverVaultData(this.VAULT_PASSWORD);
        if (!vaultData?.sharedSecret) {
          throw new Error('Quebra de Conexão: sharedSecret indisponível no cache e no contexto.');
        }
        activeSecret = vaultData.sharedSecret;
        cachedPermissions = vaultData.permissions;
        vaultDhResult = vaultData.dhResult;

        console.log(
          `%c🔒 [VAULT]%c sharedSecret + permissions recuperados com sucesso da custódia local.`,
          LOG_STYLES.storage, ''
        );
      }

      // ─────────────────────────────────────────────────────────────────
      // STAGE 3: DECIFRAR VIA WORKER
      // ─────────────────────────────────────────────────────────────────
      const workerResult = await SessionWorkerPipe.process(encrypted, activeSecret);
      if (!workerResult.session?.id_prospect) {
        throw new Error('Falha de Integridade: id_prospect ausente no resultado do Worker.');
      }

      // ─────────────────────────────────────────────────────────────────
      // STAGE 4: SEPARAÇÃO DE ESCOPOS (Hidratação da RAM)
      // ─────────────────────────────────────────────────────────────────
      // Se viemos do Vault, reinjeta as chaves matemáticas de volta na tupla metadata do contexto
      if (vaultDhResult) {
        console.log(`%c🔑 [CRYPTO]%c Hidratando a tupla metadata na RAM com o contrato recuperado do Vault.`, LOG_STYLES.crypto, '');
        this.context.setDHResult(vaultDhResult); 
      }

      const { interactions, navigation, rwu, status, ...cleanSession } = workerResult.session as any;
      const dataScope: Session = cleanSession;
      this.context.setSession(dataScope);

      const permitionScope: SessionPermition = {
        ...(interactions ? { interactions } : {}),
        ...(navigation ? { navigation } : {}),
        ...(rwu ? { rwu } : {}),
        ...(status ? { status } : {}),
      };
      this.context.updatePermitions(permitionScope);

      console.log(
        `%c🧠 [CONTEXT]%c Estrutura de Session e Permitions reconstruídas e unificadas na RAM.`,
        LOG_STYLES.success, ''
      );

      // ─────────────────────────────────────────────────────────────────
      // STAGE 5: RENOVAÇÃO VIA REDE (Orquestrado)
      // ─────────────────────────────────────────────────────────────────
      const freezeToken: string | undefined =
        this.context.currentState.data?.permition?.['navigation']?.['freezerToken'] ??
        (cachedPermissions as any)?.['navigation']?.['freezerToken'];

      if (!freezeToken) {
        console.log(
          `%c🛡️ [ANTI-BOT]%c freezerToken ausente nas permissions — renovação de rede pulada.`,
          LOG_STYLES.antibot, ''
        );
      } else {
        try {
          // Força o estado PUBLIC para blindar a chamada de rede à rota externa
          this.context.setOperation(SessionTag.PUBLIC);
          await this.rehydrateViaFreezeToken(activeSecret, dataScope.id_prospect);
        } catch (netErr) {
          console.log(
            `%c❌ [CRITICAL ERROR]%c Renovação de rede falhou. Operando em fallback com dados locais da RAM.`,
            LOG_STYLES.error, ''
          );
        }
      }

      // ─────────────────────────────────────────────────────────────────
      // STAGE 6: SELAR CONTEXTO
      // ─────────────────────────────────────────────────────────────────
      this.context.setOperation(SessionTag.REST);
      console.log(
        `%c🚀 [SUCCESS]%c Esteira REHYDRATE finalizada. Contexto selado em estável: "${this.context.currentState.tag}"`,
        LOG_STYLES.success, ''
      );
    } catch (error) {
      const errorMsg = (error as any).message || 'Erro desconhecido';
      console.log(`%c❌ [CRITICAL ERROR]%c Bloqueio na esteira REHYDRATE: ${errorMsg}`, LOG_STYLES.error, '');
      throw error;
    }
  }

  /**
   * RENOVAÇÃO VIA FREEZE TOKEN
   */
  private async rehydrateViaFreezeToken(sharedSecret: string, idProspect: string): Promise<void> {
    const idPayload = {
      id_prospect: idProspect,
      intent: 'SESSION_REHYDRATION',
      ts: Date.now(),
    };

    const encryptedId = await SessionWorkerPipe.encryptJson(idPayload, sharedSecret);
    console.log(
      `%c🔑 [CRYPTO]%c Payload de intenção e identificação cifrados via Web Worker.`,
      LOG_STYLES.crypto, ''
    );

    const payloadContrato = {
      iv: encryptedId.iv,
      ciphertext: encryptedId.ciphertext,
    };

    try {
      const freshPayload = await this.orchestrator.executeAssignment(payloadContrato);
      const freshResult = await SessionWorkerPipe.decryptJson(freshPayload, sharedSecret);
      const antiBotData = freshResult.session ? freshResult.session : freshResult;

      console.log(
        `%c🛰️ [NETWORK]%c Resposta do servidor recebida e decifrada com sucesso.`,
        LOG_STYLES.success, ''
      );

      if (antiBotData && antiBotData.refreshPassport) {
        this.context.updatePermitions({
          status: antiBotData.status,
          navigation: {
            ...((this.context.currentState.data?.permition as any)?.['navigation'] || {}),
            refreshPassport: antiBotData.refreshPassport, 
            minWaitSeconds: antiBotData.minWait
          }
        });

        console.log(
          `%c🎫 [PASSPORT]%c Novo passaporte de tráfego injetado nas permissions: ${antiBotData.refreshPassport.substring(0, 8)}...`,
          LOG_STYLES.success, ''
        );
      } else {
        throw new Error('Falha de leitura: refreshPassport ausente no payload decifrado.');
      }

    } catch (decryptErr) {
      console.log(
        `%c❌ [CRITICAL ERROR]%c Falha crítica ao processar ou descriptografar resposta do servidor.`,
        LOG_STYLES.error, ''
      );
      throw decryptErr; 
    } finally {
      this.context.setOperation(SessionTag.REHYDRATE);
      console.log(
        `%c🔄 [REHYDRATE]%c Ciclo de rede resolvido. Retornando tag da esteira para: "${this.context.currentState.tag}"`,
        LOG_STYLES.payload, ''
      );
    }
  }
}
