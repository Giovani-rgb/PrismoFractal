import { Injectable, inject } from '@angular/core';
import { SessionService } from '../services/session.service';
import { SessionContext } from '../context/session.context';
import { SessionTag, Session } from '../models/session.model';
import { environment } from '../../environments/environment';
import { lastValueFrom } from 'rxjs';
import { SessionWorkerPipe } from '../pipes/session-worker.pipe';

@Injectable({ providedIn: 'root' })
export class SessionCreationExecution {
  private readonly SECRET = environment.appSessionSecret;
  private service = inject(SessionService);
  private context = inject(SessionContext);

  async execute(): Promise<void> {
    // [INIT] Início determinístico da rota
    this.context.setOperation(SessionTag.CREATE);

    try {
      // STAGE 1: Ingestão (API Inbound)
      const raw = await lastValueFrom(this.service.fetchNewSession());
      console.log(`%c[Stage 1] Inbound detectado.`, 'color: #a5b4fc');

      // STAGE 2: Processamento (Web Worker Pipe)
      // Delegamos a criptografia e a Porta XOR para a thread isolada
      const workerResult = await SessionWorkerPipe.process(raw, this.SECRET);
      
      // STAGE 3: Validação de Conformidade (Determinismo local)
      // Aqui garantimos que o que saiu do Worker é utilizável
      await this.stageComplianceValidation(workerResult);

      // STAGE 4: Persistência e Finalização (Selo REST)
      this.service.saveToStorage(raw); 
      this.stageFinalization(workerResult.session);

    } catch (error) {
      this.handleExecutionError(error);
    }
  }

  /**
   * STAGE 3: Verifica se o objeto processado pelo Worker 
   * atende aos requisitos mínimos do Prismo.
   */
  private async stageComplianceValidation(result: any): Promise<void> {
    if (!result.session?.id_prospect) {
      throw new Error("Falha de conformidade: ID Prospect ausente.");
    }
    
    // Log de auditoria de peso e densidade recuperados do Worker
    console.log(`[Stage 3] Entropy: ${result.density} | Weight: ${result.weight}kb`);
  }

  /**
   * STAGE 4: Encerra a esteira e coloca o objeto em repouso.
   */
  private stageFinalization(session: Session): void {
    this.context.setSession(session);
    console.log(`%c[Stage 4] Finalization: Rota CREATE -> REST.`, 'color: #10b981');
  }

  private handleExecutionError(err: any): void {
    console.error(`%c[Execution Error] Bloqueio Determinístico:`, 'color: #ef4444', err);
    this.service.clearStorage();
    this.context.clear();
  }
}

