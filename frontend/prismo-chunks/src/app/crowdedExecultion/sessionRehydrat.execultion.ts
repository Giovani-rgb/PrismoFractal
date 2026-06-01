import { Injectable, inject } from '@angular/core';
import { lastValueFrom } from 'rxjs';

import { SessionPipelineOrchestrator } from '../services-workers/SessionPipelineOrchestrator';
import { SessionContext } from '../context/session.context';
import { SessionService } from '../services/session.service';

import { SessionTag, PrismoSessionState, Session, SessionPermition } from '../models/session.model';
import { SessionWorkerPipe } from '../pipes/session-worker.pipe';
import { SessionCacheService } from '../private/session-cache.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SessionRehydrationExecution {

  private readonly STORAGE_KEY  = environment.nameSessionKey;
  private readonly VAULT_PASSWORD = environment.vaultPassword;

  private orchestrator = inject(SessionPipelineOrchestrator);
  private context      = inject(SessionContext);
  private cacheService = inject(SessionCacheService);
  private service      = inject(SessionService);

  private readonly LOG_TITLES = 'font-weight: bold; padding: 2px 4px; border-radius: 3px;';

  async execute(): Promise<void> {
    console.log(`%c[Esteira] 🔄 REHYDRATE pipeline acionado. Analisando integridade...`, 'color: #a5b4fc; font-style: italic;');

    const state: PrismoSessionState = this.context.currentState;

    if (state.tag === SessionTag.REST && state.data) {
      console.log(`%c[Curto-Circuito] 🟢 Estado ativo em 'REST' com payload íntegro na RAM.`, 'color: #10b981; font-weight: bold;');
      return;
    }

    this.context.setOperation(SessionTag.VOID);
    this.context.setOperation(SessionTag.REHYDRATE);
    console.log(`%c[Contrato] 🔍 Tag fixada: "${this.context.currentState.tag}"`, 'color: #38bdf8;');

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
      // STAGE 2: RESOLUÇÃO DO SEGREDO (RAM ou Vault)
      // ─────────────────────────────────────────────────────────────────
      let activeSecret: string | undefined = this.context.currentState.dhResult?.sharedSecret;
      let cachedPermissions: SessionPermition | null = null;
      let vaultSessionToken: string | undefined;

      if (!activeSecret) {
        const vaultData = this.cacheService.recoverVaultData(this.VAULT_PASSWORD);
        if (!vaultData?.sharedSecret) {
          throw new Error('Quebra de Conexão: sharedSecret indisponível no cache e no contexto.');
        }
        activeSecret      = vaultData.sharedSecret;
        cachedPermissions = vaultData.permissions;
        vaultSessionToken = vaultData.sessionToken;
        console.log(`%c VAULT %c Segredo + token recuperados do cache local.`,
          `background: #6d28d9; color: #fff; ${this.LOG_TITLES}`, 'color: #c084fc;');
      }

      // ─────────────────────────────────────────────────────────────────
      // STAGE 3: DECIFRAR VIA WORKER
      // ─────────────────────────────────────────────────────────────────
      const workerResult = await SessionWorkerPipe.process(encrypted, activeSecret);
      if (!workerResult.session?.id_prospect) {
        throw new Error('Falha de Integridade: id_prospect ausente no resultado do Worker.');
      }

      // ─────────────────────────────────────────────────────────────────
      // STAGE 4: SEPARAÇÃO DE ESCOPOS
      // ─────────────────────────────────────────────────────────────────
      const { interactions, navigation, rwu, status, ...cleanSession } = workerResult.session as any;
      const dataScope: Session = cleanSession;
      this.context.setSession(dataScope);

      const permitionScope: SessionPermition = {
        ...(interactions ? { interactions } : {}),
        ...(navigation   ? { navigation }   : {}),
        ...(rwu          ? { rwu }          : {}),
        ...(status       ? { status }       : {}),
      };
      this.context.updatePermitions(permitionScope);
      this.context.setOperation(SessionTag.REHYDRATE);

      console.log(`%c[Stage 4] ✅ Contexto reconstruído localmente. Tag: "${this.context.currentState.tag}"`, 'color: #fbbf24; font-weight: bold;');
      console.dir(this.context.currentState);

      // ─────────────────────────────────────────────────────────────────
      // STAGE 5: RENOVAÇÃO VIA REDE — /public → /refresh (passport)
      // ─────────────────────────────────────────────────────────────────
      const sessionToken = this.context.currentState.data?.token ?? vaultSessionToken;

      if (sessionToken) {
        console.log(`%c STAGE 5 %c Iniciando renovação via /public → /refresh com passaporte DH...`,
          `background: #0891b2; color: #fff; ${this.LOG_TITLES}`, 'color: #67e8f9;');

        try {
          await this.rehydrateViaNetwork(sessionToken);
        } catch (netError) {
          console.warn(`%c[Stage 5] ⚠️ Renovação de rede falhou. Operando com dados locais.`,
            'color: #f59e0b', netError);
        }
      } else {
        console.warn(`%c[Stage 5] ⚠️ sessionToken ausente — renovação de rede pulada.`, 'color: #f59e0b');
      }

      // ─────────────────────────────────────────────────────────────────
      // STAGE 6: SELAR CONTEXTO
      // ─────────────────────────────────────────────────────────────────
      this.context.setOperation(SessionTag.REST);
      console.log(`%c[Prismo] 🚀 Esteira REHYDRATE concluída. Contexto selado em: "${this.context.currentState.tag}"`,
        'color: #10b981; font-weight: bold;');
      console.dir(this.context.currentState);

    } catch (error) {
      console.error(`%c[Rehydrate Error] ❌ Falha na esteira:`, 'color: #ef4444', error);
      throw error;
    }
  }

  /**
   * RENOVAÇÃO DE REDE
   * 1. Executa handshake DH completo via /public (direto, sem interceptor)
   * 2. Chama /refresh com o passaporte gerado + JWT da sessão
   * 3. Atualiza sessionStorage, dhResult no contexto e Vault
   */
  private async rehydrateViaNetwork(sessionToken: string): Promise<void> {
    // Usar tag VOID temporariamente para que o sessionGatekeeper não injete headers incorretos
    this.context.setOperation(SessionTag.VOID);

    // — Phase 1: /public init —
    const phase1 = await lastValueFrom(this.service.publicHandshakeDirect());
    console.log(`%c[Rehydrate Net] 🔑 Phase 1 OK — windowToken: ${phase1.windowToken?.substring(0, 8)}...`,
      'color: #38bdf8;');

    // — DH computation (Web Worker) —
    const dhContext = await SessionWorkerPipe.stage_dh({ p: phase1.p, g: phase1.g });

    // — Phase 2: /public finalize (with windowToken + B) —
    const phase2 = await lastValueFrom(
      this.service.publicHandshakeDirect(dhContext.B, phase1.windowToken)
    );
    const passportToken: string = phase2.anonymousToken;
    console.log(`%c[Rehydrate Net] 🛂 Passaporte emitido: ${passportToken?.substring(0, 8)}...`,
      'color: #38bdf8;');

    // — Calculate shared secret —
    const dhResult = await SessionWorkerPipe.calculateDH(phase2.A, dhContext);
    if (!dhResult.sharedSecret) {
      throw new Error('[Rehydrate Net] sharedSecret ausente após cálculo DH.');
    }

    // — /refresh com passaporte —
    this.context.setOperation(SessionTag.REHYDRATE);
    const freshPayload = await lastValueFrom(
      this.service.refreshWithPassportDirect(passportToken, sessionToken)
    );
    console.log(`%c[Rehydrate Net] ✅ /refresh OK — payload fresco recebido.`, 'color: #10b981;');

    // — Persistir DH result no contexto —
    this.context.setDHResult(dhResult);

    // — Atualizar sessionStorage com payload fresco —
    this.service.saveToStorage(freshPayload);

    // — Atualizar Vault com novo sharedSecret + sessionToken —
    try {
      this.cacheService.saveCurrentContextToVault(this.VAULT_PASSWORD);
      console.log(`%c[Rehydrate Net] 🔒 Vault atualizado com novo sharedSecret.`, 'color: #818cf8;');
    } catch (vaultErr) {
      console.warn(`%c[Rehydrate Net] ⚠️ Vault não atualizado (dados no contexto ausentes?).`,
        'color: #f59e0b', vaultErr);
    }
  }
}
