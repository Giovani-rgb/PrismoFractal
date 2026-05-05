import { Injectable, inject } from '@angular/core';
import { SessionPipelineOrchestrator } from '../services-workers/SessionPipelineOrchestrator';
import { SessionContext } from '../context/session.context';
import { Session, SessionTag } from '../models/session.model';
import { SessionWorkerPipe } from '../pipes/session-worker.pipe';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SessionCreationExecution {
  private readonly SECRET = environment.appSessionSecret;

  private orchestrator = inject(SessionPipelineOrchestrator);
  private context = inject(SessionContext);

  /**
   * Executa o fluxo completo de criação de sessão com Handshake DH e Anti-Bot.
   */
  async execute(): Promise<void> {
    try {
      // --- STAGE 0: HANDSHAKE MATEMÁTICO ---
      this.context.setOperation(SessionTag.PUBLIC);

      // 1. Drop inicial (p, g, A, windowToken, minWait)
      const dhParams = await this.orchestrator.executeAssignment();
      const startTime = Date.now();

      console.log(`%c[Stage 0.1] Handshake iniciado. Token: ${dhParams.windowToken}`, 'color: #fbbf24');
      (window as any)._sessionToken = dhParams.windowToken;

      // 2. Worker Calcula: B e Shared Secret
      const dhContext = await SessionWorkerPipe.stage_dh({ p: dhParams.p, g: dhParams.g });
      await SessionWorkerPipe.calculateDH(dhParams.A, dhContext);

      // 3. Compliance Temporal do Primeiro Handshake
      const elapsedFirst = (Date.now() - startTime) / 1000;
      const waitFirst = (dhParams.minWait || 2.9) - elapsedFirst;

      if (waitFirst > 0) {
        console.log(`%c[Anti-Bot] Aguardando ${waitFirst.toFixed(2)}s...`, 'color: #60a5fa');
        await new Promise(resolve => setTimeout(resolve, waitFirst * 1000));
      }

      // 4. Envio de B para validação e recebimento do AnonymousToken + novo minWait
      const stage2Response = await this.orchestrator.executeAssignment({ B: dhContext.B });

      if (!stage2Response || stage2Response.status !== "established") {
        throw new Error('Falha ao estabelecer túnel seguro: Status inválido.');
      }

      // --- STAGE 1: PREPARAÇÃO PARA /ANONYMOUS ---
      (window as any)._anonymousToken = stage2Response.anonymousToken;
      const nextWait = stage2Response.minWait || 2.8;
      const startAnonymousClock = Date.now();

      console.log(`%c[Stage 0.3] Token de passagem: ${stage2Response.anonymousToken}`, 'color: #fbbf24');
      console.log(`%c[Anti-Bot] Janela para /anonymous: ${nextWait}s`, 'color: #60a5fa');

      // 5. Compliance Temporal para a rota CREATE
      this.context.setOperation(SessionTag.CREATE);

      const elapsedSecond = (Date.now() - startAnonymousClock) / 1000;
      const remaining = nextWait - elapsedSecond;

      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining * 1000));
      }

      // 6. Ingestão da Sessão Cifrada
      const raw = await this.orchestrator.executeAssignment();
      console.log(`%c[Stage 1] Payload recebido.`, 'color: #a5b4fc');

      // 7. Processamento e Descriptografia
      const workerResult = await SessionWorkerPipe.process(raw, this.SECRET);
      
      // 8. Validação e Finalização
      await this.stageComplianceValidation(workerResult);
      this.stageFinalization(workerResult.session);

    } catch (error) {
      this.handleExecutionError(error);
    }
  }

  private async stageComplianceValidation(result: any): Promise<void> {
    if (!result.session?.id_prospect) {
      throw new Error('Atributos de sessão incompletos.');
    }
    console.log(`[Stage 3] Conformidade OK.`);
  }

  private stageFinalization(session: Session): void {
    this.context.setSession(session);
    console.log(`%c[Stage 4] Sessão ativa.`, 'color: #10b981');
  }

  private handleExecutionError(err: any): void {
    const errorMsg = err.error?.error || err.message || 'Erro desconhecido';
    console.error(`%c[Execution Error] Bloqueio: ${errorMsg}`, 'color: #ef4444');
    
    this.context.clear();
    (window as any)._sessionToken = null;
    (window as any)._anonymousToken = null;
  }
}

