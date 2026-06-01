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

  private readonly STORAGE_KEY    = environment.nameSessionKey;
  private readonly VAULT_PASSWORD = environment.vaultPassword;

  private orchestrator = inject(SessionPipelineOrchestrator);
  private context      = inject(SessionContext);
  private cacheService = inject(SessionCacheService);
  private service      = inject(SessionService);

  private readonly LOG_BADGE = 'font-weight: bold; padding: 2px 4px; border-radius: 3px;';

  async execute(): Promise<void> {
    console.log(`%c[Esteira] 🔄 REHYDRATE pipeline acionado. Analisando integridade...`,
      'color: #a5b4fc; font-style: italic;');

    const state: PrismoSessionState = this.context.currentState;

    if (state.tag === SessionTag.REST && state.data) {
      console.log(`%c[Curto-Circuito] 🟢 Estado ativo em 'REST' com payload íntegro na RAM.`,
        'color: #10b981; font-weight: bold;');
      return;
    }

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

      if (!activeSecret) {
        const vaultData = this.cacheService.recoverVaultData(this.VAULT_PASSWORD);
        if (!vaultData?.sharedSecret) {
          throw new Error('Quebra de Conexão: sharedSecret indisponível no cache e no contexto.');
        }
        activeSecret      = vaultData.sharedSecret;
        cachedPermissions = vaultData.permissions;

        console.log(`%c VAULT %c sharedSecret + permissions (freezerToken incluso) recuperados.`,
          `background: #6d28d9; color: #fff; ${this.LOG_BADGE}`, 'color: #c084fc;');
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

      console.log(
        `%c[Stage 4] ✅ Contexto reconstruído localmente. Tag: "${this.context.currentState.tag}"`,
        'color: #fbbf24; font-weight: bold;'
      );

      // ─────────────────────────────────────────────────────────────────
      // STAGE 5: RENOVAÇÃO VIA REDE — freeze token → /public (rehydrate run)
      // ─────────────────────────────────────────────────────────────────

      // O freezeToken vive em permissions.navigation.freezerToken
      // (gerado em CryptoHelper.upgradeToFreezerContext e incluído no payload)
      const freezeToken: string | undefined =
        this.context.currentState.data?.permition?.['navigation']?.['freezerToken']
        ?? (cachedPermissions as any)?.['navigation']?.['freezerToken'];

      if (!freezeToken) {
        console.warn(`%c[Stage 5] ⚠️ freezerToken ausente nas permissions — renovação de rede pulada.`,
          'color: #f59e0b');
      } else {
        console.log(
          `%c STAGE 5 %c Renovando via freeze token → /public (rehydrate run)...`,
          `background: #0891b2; color: #fff; ${this.LOG_BADGE}`, 'color: #67e8f9;'
        );
        try {
          await this.rehydrateViaFreezeToken(freezeToken, activeSecret, dataScope.id_prospect);
        } catch (netErr) {
          console.warn(`%c[Stage 5] ⚠️ Renovação de rede falhou. Operando com dados locais.`,
            'color: #f59e0b', netErr);
        }
      }

      // ─────────────────────────────────────────────────────────────────
      // STAGE 6: SELAR CONTEXTO
      // ─────────────────────────────────────────────────────────────────
      this.context.setOperation(SessionTag.REST);
      console.log(
        `%c[Prismo] 🚀 Esteira REHYDRATE concluída. Contexto selado em: "${this.context.currentState.tag}"`,
        'color: #10b981; font-weight: bold;'
      );

    } catch (error) {
      console.error(`%c[Rehydrate Error] ❌ Falha na esteira:`, 'color: #ef4444', error);
      throw error;
    }
  }

  /**
   * RENOVAÇÃO VIA FREEZE TOKEN
   *
   * Fluxo:
   * 1. Encripta { id_prospect, ts } com sharedSecret (via Web Worker / AES-256-GCM)
   * 2. POST /public com { freezeToken, iv, ciphertext }
   * 3. Servidor decifra, valida sessão, devolve sessão re-encriptada com o mesmo sharedSecret
   * 4. Decifra resposta e atualiza contexto + sessionStorage + vault
   *
   * Nenhum novo handshake DH é necessário — o sharedSecret já está no vault.
   */
  private async rehydrateViaFreezeToken(
    freezeToken: string,
    sharedSecret: string,
    idProspect: string
  ): Promise<void> {

    // 1. Encripta payload de identificação com sharedSecret (Web Worker)
    const idPayload = { id_prospect: idProspect, ts: Date.now() };
    const encryptedId = await SessionWorkerPipe.encryptJson(idPayload, sharedSecret);
    console.log(`%c[Rehydrate Net] 🔐 Payload de identificação encriptado.`, 'color: #38bdf8;');

    // 2. POST /public com freeze token — sem new DH, sem JWT
    const freshPayload = await lastValueFrom(
      this.service.rehydrateWithFreezeToken(freezeToken, encryptedId.iv, encryptedId.ciphertext)
    );
    console.log(`%c[Rehydrate Net] ✅ Sessão fresca recebida do servidor.`, 'color: #10b981;');

    // 3. Decifra sessão fresca com o mesmo sharedSecret
    const freshResult = await SessionWorkerPipe.process(freshPayload, sharedSecret);
    if (!freshResult.session?.id_prospect) {
      throw new Error('[Rehydrate Net] Sessão fresca inválida — id_prospect ausente.');
    }

    // 4. Atualiza contexto com dados frescos (lastAccessAt, expiresAt, etc.)
    const { interactions, navigation, rwu, status, ...freshClean } = freshResult.session as any;
    this.context.setSession(freshClean as Session);
    this.context.updatePermitions({ interactions, navigation, rwu, status });
    this.context.setOperation(SessionTag.REHYDRATE);

    // 5. Persiste payload fresco em sessionStorage
    this.service.saveToStorage(freshPayload);

    // 6. Atualiza vault com dados frescos
    try {
      this.cacheService.saveCurrentContextToVault(this.VAULT_PASSWORD);
      console.log(`%c[Rehydrate Net] 🔒 Vault atualizado com dados frescos.`, 'color: #818cf8;');
    } catch (vaultErr) {
      console.warn(`%c[Rehydrate Net] ⚠️ Vault não pôde ser atualizado.`, 'color: #f59e0b', vaultErr);
    }
  }
}
