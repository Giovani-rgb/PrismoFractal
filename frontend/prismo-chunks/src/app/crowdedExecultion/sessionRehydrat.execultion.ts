import { Injectable, inject } from '@angular/core';

import { SessionPipelineOrchestrator } from '../services-workers/SessionPipelineOrchestrator';
import { SessionContext } from '../context/session.context';

import { SessionTag, PrismoSessionState, Session, SessionPermition } from '../models/session.model';
import { SessionWorkerPipe } from '../pipes/session-worker.pipe';
import { SessionCacheService } from '../private/session-cache.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SessionRehydrationExecution {
  private readonly STORAGE_KEY = environment.nameSessionKey;
  private readonly VAULT_PASSWORD = environment.vaultPassword;

  private orchestrator = inject(SessionPipelineOrchestrator);
  private context = inject(SessionContext);
  private cacheService = inject(SessionCacheService);

  private readonly LOG_BADGE = 'font-weight: bold; padding: 2px 4px; border-radius: 3px;';

  async execute(): Promise<void> {
    console.log(
      `%c[Esteira] 🔄 REHYDRATE pipeline acionado. Analisando integridade...`,
      'color: #a5b4fc; font-style: italic;',
    );

    const state: PrismoSessionState = this.context.currentState;

    // Curto-circuito caso a sessão já esteja ativa na RAM
    if (state.tag === SessionTag.REST && state.data) {
      console.log(
        `%c[Curto-Circuito] 🟢 Estado ativo em 'REST' com payload íntegro na RAM.`,
        'color: #10b981; font-weight: bold;',
      );
      return;
    }

    // [Contrato] Se não está em REST, fixa em PUBLIC até concluir a rota pública externa
    this.context.setOperation(SessionTag.PUBLIC);
    console.log(
      `%c[Contrato] 🔍 Tag fixada: "${this.context.currentState.tag}"`,
      'color: #38bdf8;',
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
      // STAGE 2: RESOLUÇÃO DO SEGREDO (RAM ou Vault)
      // ─────────────────────────────────────────────────────────────────
      let activeSecret: string | undefined = this.context.currentState.dhResult?.sharedSecret;
      let cachedPermissions: SessionPermition | null = null;

      if (!activeSecret) {
        const vaultData = this.cacheService.recoverVaultData(this.VAULT_PASSWORD);
        if (!vaultData?.sharedSecret) {
          throw new Error('Quebra de Conexão: sharedSecret indisponível no cache e no contexto.');
        }
        activeSecret = vaultData.sharedSecret;
        cachedPermissions = vaultData.permissions;

        console.log(
          `%c VAULT %c sharedSecret + permissions recuperados.`,
          `background: #6d28d9; color: #fff; ${this.LOG_BADGE}`,
          'color: #c084fc;',
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
      const { interactions, navigation, rwu, status, ...cleanSession } =
        workerResult.session as any;
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
        `%c[Stage 4] ✅ Contexto reconstruído localmente na RAM.`,
        'color: #fbbf24; font-weight: bold;',
      );

      // ─────────────────────────────────────────────────────────────────
      // STAGE 5: RENOVAÇÃO VIA REDE (Orquestrado)
      // ─────────────────────────────────────────────────────────────────
      const freezeToken: string | undefined =
        this.context.currentState.data?.permition?.['navigation']?.['freezerToken'] ??
        (cachedPermissions as any)?.['navigation']?.['freezerToken'];

      if (!freezeToken) {
        console.warn(
          `%c[Stage 5] ⚠️ freezerToken ausente nas permissions — renovação de rede pulada.`,
          'color: #f59e0b',
        );
      } else {
        try {
          // Aqui basicamente tem de garantir o estado PUBLIC devido ao stage 4 definir para a tag para REST
         this.context.setOperation(SessionTag.PUBLIC);
          // Mantém o estado previsível e delega a chamada de rede externa
          await this.rehydrateViaFreezeToken(activeSecret, dataScope.id_prospect);
        } catch (netErr) {
          console.warn(
            `%c[Stage 5] ⚠️ Renovação de rede falhou. Operando com dados locais baseados na RAM.`,
            'color: #f59e0b',
            netErr,
          );
        }
      }

      // ─────────────────────────────────────────────────────────────────
      // STAGE 6: SELAR CONTEXTO
      // ─────────────────────────────────────────────────────────────────
      this.context.setOperation(SessionTag.REST);
      console.log(
        `%c[Prismo] 🚀 Esteira REHYDRATE concluída. Contexto selado em: "${this.context.currentState.tag}"`,
        'color: #10b981; font-weight: bold;',
      );
    } catch (error) {
      console.error(`%c[Rehydrate Error] ❌ Falha na esteira:`, 'color: #ef4444', error);
      throw error;
    }
  }

  /**
   * RENOVAÇÃO VIA FREEZE TOKEN
   * Envia a intenção e a identificação criptografada para o servidor.
   */
  private async rehydrateViaFreezeToken(sharedSecret: string, idProspect: string): Promise<void> {
    // 1. Encripta payload de identificação inserindo a intenção (operação) desejada pelo servidor em "/public"
    const idPayload = {
      id_prospect: idProspect,
      intent: 'SESSION_REHYDRATION',
      ts: Date.now(),
    };

    const encryptedId = await SessionWorkerPipe.encryptJson(idPayload, sharedSecret);
    console.log(
      `%c[Rehydrate Net] 🔐 Payload de identificação + intenção encriptados via Web Worker.`,
      'color: #38bdf8;',
    );

    // 2. Montagem do contrato para o Orquestrador (Apenas a cifra AES-256)
    const payloadContrato = {
      iv: encryptedId.iv,
      ciphertext: encryptedId.ciphertext,
    };

    try {
      // Executa a chamada. Como mapeado, o estado permanece PUBLIC até o retorno do servidor.
      const freshPayload = await this.orchestrator.executeAssignment(payloadContrato);

      // [Ajuste] Print temporário solicitado para auditoria (visto que o servidor ainda não responde criptografado)
      console.log(
        `%c[Rehydrate Net] 🛰️ Payload bruto recebido do Servidor (Não Criptografado):`,
        'color: #a855f7; font-weight: bold;',
        freshPayload,
      );
    } finally {
      // 3. Transição de estado pós-chamada da rota pública: Próximo passo é aguardar o tempo do token na rota "/refresh"
      this.context.setOperation(SessionTag.REHYDRATE);
      console.log(
        `%c[Orquestrador] 🔙 Ciclo de rede resolvido. Mutando tag para: "${this.context.currentState.tag}"`,
        'color: #e0f2fe;',
      );
    }
  }
}
