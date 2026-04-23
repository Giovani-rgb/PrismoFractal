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

  async execute(): Promise<void> {
    try {
      // --- STAGE 0: HANDSHAKE MATEMÁTICO (AES-GCM PREP) ---
      // Definimos a Tag para PUBLIC para o Orquestrador saber qual contrato usar
      this.context.setOperation(SessionTag.PUBLIC);

      // 1. Drop inicial: Pega p, g, A do servidor
      const dhParams = await this.orchestrator.executeAssignment();

console.log(`%c[Stage 0.1] Parâmetros DH recebidos. Drop A detectado.`, 'color: #fbbf24');
console.log('%c[Raw Data]:', 'color: #94a3b8', dhParams);
    

      // 2. REGISTRO IMEDIATO: O Interceptor precisa ler isso AGORA
      (window as any)._sessionToken = dhParams.windowToken;


      

      // 2.1 Worker Calcula: Gera produto 'B' e a Shared Secret (Key para AES-GCM)

      const cryptoSetup = await SessionWorkerPipe.calculateDH(dhParams);

      // --- ADICIONE ESTA LINHA PARA DEBUG ---
      console.log(
        `%c[DEBUG] Shared Secret Key:`,
        'color: #00ff00; font-weight: bold',
        cryptoSetup.sharedSecret,
      );

      console.log(
        `%c[Stage 0.2] Produto B gerado via Worker. Shared Secret calculada.`,
        'color: #fbbf24',
      );

      // 3. Callback: Envia produto 'B' para o servidor fechar o segredo do lado dele
      await this.orchestrator.executeAssignment({
        B: cryptoSetup.B,
      });
      console.log(
        `%c[Stage 0.3] Handshake finalizado. Canal criptográfico pronto.`,
        'color: #fbbf24',
      );

      // --- STAGE 1: INGESTÃO (CREATE) ---
      this.context.setOperation(SessionTag.CREATE);
      const raw = await this.orchestrator.executeAssignment();
      console.log(`%c[Stage 1] Inbound detectado (Cifrado com AES-GCM).`, 'color: #a5b4fc');

      // STAGE 2: PROCESSAMENTO (DECRYPT & MAP)
      // Agora o Worker usa a Shared Secret obtida no Stage 0 para descriptografar o raw
      const workerResult = await SessionWorkerPipe.process(raw, this.SECRET);
      console.log(`%c[Stage 2] Worker processado (Payload descriptografado).`, 'color: #a5b4fc');

      // STAGE 3: VALIDAÇÃO
      await this.stageComplianceValidation(workerResult);

      // STAGE 4: FINALIZAÇÃO
      this.stageFinalization(workerResult.session);
    } catch (error) {
      this.handleExecutionError(error);
    }
  }

  private async stageComplianceValidation(result: any): Promise<void> {
    if (!result.session?.id_prospect) {
      throw new Error('Falha de conformidade: ID Prospect ausente.');
    }
    console.log(`[Stage 3] Entropy: ${result.density} | Weight: ${result.weight}kb`);
  }

  private stageFinalization(session: Session): void {
    this.context.setSession(session);
    console.log(`%c[Stage 4] Finalization: Rota CREATE -> REST.`, 'color: #10b981');
  }

  private handleExecutionError(err: any): void {
    console.error(`%c[Execution Error] Bloqueio na Criação:`, 'color: #ef4444', err);
    this.context.clear();
  }
}
