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
      // --- STAGE 0: HANDSHAKE MATEMÁTICO (AES-GCM PREP) ---
      this.context.setOperation(SessionTag.PUBLIC);

      // 1. Drop inicial: Recebe p, g, A, windowToken e minWait do Java
      const dhParams = await this.orchestrator.executeAssignment();
      const startTime = Date.now(); // Marca o início para validar a janela de tempo

      console.log(`%c[Stage 0.1] Handshake iniciado. Token: ${dhParams.windowToken}`, 'color: #fbbf24');
      console.log(`%c[Anti-Bot] Tempo mínimo exigido pelo servidor: ${dhParams.minWait}s`, 'color: #60a5fa');
    
      // 2. Registro do token para que o Interceptor o envie no header 'X-Window-Token'
      (window as any)._sessionToken = dhParams.windowToken;

      // 3. Worker Calcula: Gera o produto B (público do cliente)
      const dhContext = await SessionWorkerPipe.stage_dh({
        p: dhParams.p,
        g: dhParams.g
      });

      // 4. Calcula a Shared Secret (S) usando o A do servidor
      const cryptoSetup = await SessionWorkerPipe.calculateDH(dhParams.A, dhContext);

      console.log(`%c[Stage 0.2] Shared Secret gerada localmente.`, 'color: #fbbf24');

      // --- LÓGICA DE COMPLIANCE TEMPORAL (ANTI-BOT) ---
      // Verificamos quanto tempo passou desde o drop inicial
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const waitTime = (dhParams.minWait || 2.9) - elapsedSeconds;

      if (waitTime > 0) {
        console.log(`%c[Anti-Bot] Aguardando ${waitTime.toFixed(2)}s para satisfazer a política do servidor...`, 'color: #60a5fa');
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }

      // 5. STAGE 2 (CALLBACK): Envia B — servidor valida a janela comportamental
      //    e emite o anonymousToken (TTL 15s) para liberação de /anonymous
      const stage2Response = await this.orchestrator.executeAssignment({
        B: dhContext.B
      });

      // Registra o token de passagem para que o interceptor o envie em X-Anonymous-Token
      (window as any)._anonymousToken = stage2Response.anonymousToken;

      console.log(`%c[Stage 0.3] Handshake finalizado. Token de passagem emitido.`, 'color: #fbbf24');

      // --- STAGE 1: INGESTÃO (CREATE) ---
      // Agora que o canal está pronto, pedimos a criação da sessão
      this.context.setOperation(SessionTag.CREATE);
      const raw = await this.orchestrator.executeAssignment();
      
      console.log(`%c[Stage 1] Payload de sessão recebido (Cifrado).`, 'color: #a5b4fc');

      // STAGE 2: PROCESSAMENTO (DECRYPT & MAP)
      const workerResult = await SessionWorkerPipe.process(raw, this.SECRET);
      console.log(`%c[Stage 2] Descriptografia concluída via Worker.`, 'color: #a5b4fc');

      // STAGE 3: VALIDAÇÃO DE CONFORMIDADE
      await this.stageComplianceValidation(workerResult);

      // STAGE 4: FINALIZAÇÃO
      this.stageFinalization(workerResult.session);

    } catch (error) {
      this.handleExecutionError(error);
    }
  }

  private async stageComplianceValidation(result: any): Promise<void> {
    if (!result.session?.id_prospect) {
      throw new Error('Falha de conformidade: Atributos de sessão incompletos.');
    }
    console.log(`[Stage 3] Conformidade OK. Densidade: ${result.density}`);
  }

  private stageFinalization(session: Session): void {
    this.context.setSession(session);
    console.log(`%c[Stage 4] Sessão ativa e injetada no contexto.`, 'color: #10b981');
  }

  private handleExecutionError(err: any): void {
    const errorMsg = err.error?.error || err.message || 'Erro desconhecido';
    console.error(`%c[Execution Error] Bloqueio no Pipeline: ${errorMsg}`, 'color: #ef4444');
    this.context.clear();
    // Limpa ambos os tokens para forçar novo handshake completo
    (window as any)._sessionToken = null;
    (window as any)._anonymousToken = null;
  }
}
