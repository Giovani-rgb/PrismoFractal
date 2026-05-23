import { Injectable, inject } from '@angular/core';
import { SessionPipelineOrchestrator } from '../services-workers/SessionPipelineOrchestrator';
import { SessionContext } from '../context/session.context';
import { Session, SessionTag } from '../models/session.model';
import { SessionWorkerPipe } from '../pipes/session-worker.pipe';
import { SessionService } from '../services/session.service';

// Estilos padronizados para logs elegantes no DevTools
const LOG_STYLES = {
  crypto: 'background: #3b82f6; color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  antibot: 'background: #f59e0b; color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  success: 'background: #10b981; color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  payload: 'background: #8b5cf6; color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  storage: 'background: #0d9488; color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  error: 'background: #ef4444; color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;'
};

@Injectable({ providedIn: 'root' })
export class SessionCreationExecution {
  private orchestrator = inject(SessionPipelineOrchestrator);
  private context = inject(SessionContext);
  private sessionService = inject(SessionService);

  /**
   * Executa o fluxo completo de criação de sessão com Handshake DH e Anti-Bot.
   */
  async execute(): Promise<void> {
    try {
      // --- STAGE 0: HANDSHAKE MATEMÁTICO ---
      this.context.setOperation(SessionTag.PUBLIC);

      // 1. Drop inicial do servidor (p, g, A, windowToken, minWait)
      const dhParams = await this.orchestrator.executeAssignment();
      const startTime = Date.now();

      console.log(`%c🔑 [CRYPTO]%c Handshake iniciado. Token: ${dhParams.reentryToken}`, LOG_STYLES.crypto, '');
      (window as any)._sessionToken = dhParams.reentryToken;

      // 2. STAGE 1: Worker calcula as chaves locais do cliente (Retorna o DiffieHellmanModel)
      const dhContext = await SessionWorkerPipe.stage_dh({ p: dhParams.p, g: dhParams.g });

      // Injeta os metadados do estágio inicial no contexto do Prismo
      this.context.setDHContext(dhContext);
      console.log(`%c🔑 [CRYPTO]%c Chaves locais salvas no contexto (B calculado).`, LOG_STYLES.crypto, '');

      // 3. STAGE 2: Worker finaliza a matemática combinando a chave A com o contexto (Retorna o DHResult)
      const dhResult = await SessionWorkerPipe.calculateDH(dhParams.A, dhContext);

      // Injeta o resultado final com a Shared Secret resolvida no contexto do Prismo
      this.context.setDHResult(dhResult);
      console.log(`%c🔑 [CRYPTO]%c Shared Secret salva no contexto com sucesso.`, LOG_STYLES.crypto, '');

      // 4. Compliance Temporal do Primeiro Handshake (Barreira Anti-Bot)
      const elapsedFirst = (Date.now() - startTime) / 1000;
      const waitFirst = (dhParams.minWait || 2.9) - elapsedFirst;

      if (waitFirst > 0) {
        console.log(`%c🛡️ [ANTI-BOT]%c Aguardando reentry window: ${waitFirst.toFixed(2)}s...`, LOG_STYLES.antibot, '');
        await new Promise(resolve => setTimeout(resolve, waitFirst * 1000));
      }

      // 5. Envio do B (coletado do dhContext) para validação e recebimento do passaporte
      const stage2Response = await this.orchestrator.executeAssignment({ B: dhContext.B });

      if (!stage2Response || stage2Response.status !== "established") {
        throw new Error('Falha ao estabelecer túnel seguro: Status inválido de handshake.');
      }

      // --- STAGE 1: PREPARAÇÃO PARA /ANONYMOUS ---
      (window as any)._anonymousToken = stage2Response.anonymousToken;
      const nextWait = stage2Response.minWait || 2.8;
      const startAnonymousClock = Date.now();

      console.log(`%c🎫 [PASSPORT]%c Token de passagem emitido: ${stage2Response.anonymousToken}`, LOG_STYLES.success, '');
      console.log(`%c🛡️ [ANTI-BOT]%c Janela mínima para /anonymous definida em: ${nextWait}s`, LOG_STYLES.antibot, '');

      // 6. Compliance Temporal para a rota CREATE
      this.context.setOperation(SessionTag.CREATE);

      const elapsedSecond = (Date.now() - startAnonymousClock) / 1000;
      const remaining = nextWait - elapsedSecond;

      if (remaining > 0) {
        console.log(`%c🛡️ [ANTI-BOT]%c Segurando requisição por mais ${remaining.toFixed(2)}s para validação de comportamento humano.`, LOG_STYLES.antibot, '');
        await new Promise(resolve => setTimeout(resolve, remaining * 1000));
      }

      // 7. Ingestão da Sessão Cifrada em /anonymous
      const raw = await this.orchestrator.executeAssignment();
      console.log(`%c📦 [PAYLOAD]%c Resposta cifrada recebida da rota /anonymous.`, LOG_STYLES.payload, '');

      // Persistência imediata do payload criptografado no sessionStorage via SessionService
      this.sessionService.saveToStorage(raw);
      console.log(`%c💾 [STORAGE]%c Payload criptografado persistido via SessionService.`, LOG_STYLES.storage, '');

      // 8. STAGE 3: Processamento e Descriptografia Dinâmica com a chave resolvida no Stage 2
      console.log(`%c🔑 [CRYPTO]%c Descriptografando payload utilizando a Shared Secret efêmera...`, LOG_STYLES.crypto, '');
      let decryptedFlat = await SessionWorkerPipe.process(raw, dhResult.sharedSecret!);

      // Garantia de tipo: Se o pipe retornou string JSON por engano, forçamos o parse para objeto
      if (typeof decryptedFlat === 'string') {
        try { decryptedFlat = JSON.parse(decryptedFlat); } catch (_) {}
      }

      // Tratamento de Envelope: Se vier encapsulado em .data ou .session, extrai a raiz de dados
      const payloadRoot = decryptedFlat?.data || decryptedFlat?.session || decryptedFlat;

      // Log preventivo para depuração rápida no console do DevTools se as propriedades sumirem
      console.log('%c🔍 [CRYPTO-DEBUG]%c Estrutura decifrada identificada:', LOG_STYLES.payload, '', Object.keys(payloadRoot || {}));

      // --- MAPEAMENTO STRIP E CONVENIENTE PARA A GAVETA 'PERMITION' ---
      // Capturamos tanto a versão snake_case quanto camelCase para evitar quebras com o DTO do Java
      const {
        id_prospect, idProspect,
        refs,
        country,
        revoked,
        keyUpdate,
        createdAt,
        expiresAt,
        lastAccessAt,
        token,
        ...extraObjects
      } = payloadRoot;

      const structuredSession: Session = {
        id_prospect: id_prospect ?? idProspect, // Fallback automático de nomenclatura
        refs,
        country,
        revoked,
        keyUpdate,
        createdAt,
        expiresAt,
        lastAccessAt,
        token,
        permition: Object.keys(extraObjects).length > 0 ? extraObjects : undefined
      };

      // 9. Validação e Finalização da Sessão no Contexto Global do Angular
      await this.stageComplianceValidation(structuredSession);
      this.stageFinalization(structuredSession);

    } catch (error) {
      this.handleExecutionError(error);
    }
  }

  private async stageComplianceValidation(session: Session): Promise<void> {
    if (!session?.id_prospect) {
      throw new Error('Atributos de sessão incompletos ou corrompidos após a decifragem.');
    }
    console.log(`%c✅ [VALIDATION]%c Payload descriptografado e em total conformidade estrutural.`, LOG_STYLES.success, '');
  }

  private stageFinalization(session: Session): void {
    this.context.setSession(session);
    console.log(`%c🚀 [SUCCESS]%c Fluxo concluído. Sessão criptográfica ativa no contexto do Angular.`, LOG_STYLES.success, '');
  }

  private handleExecutionError(err: any): void {
    const errorMsg = err.error?.error || err.message || 'Erro desconhecido';
    console.error(`%c❌ [CRITICAL ERROR]%c Bloqueio na esteira de execução: ${errorMsg}`, LOG_STYLES.error, '');

    this.context.clear();
    (window as any)._sessionToken = null;
    (window as any)._anonymousToken = null;
  }
}
