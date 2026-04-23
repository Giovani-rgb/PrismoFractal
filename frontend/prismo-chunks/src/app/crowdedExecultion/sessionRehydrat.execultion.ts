import { Injectable, inject } from '@angular/core';

// Orquestração e Contexto
import { SessionPipelineOrchestrator } from '../services-workers/SessionPipelineOrchestrator';
import { SessionContext } from '../context/session.context';

// Infra e Modelos
import { SessionTag } from '../models/session.model';
import { SessionWorkerPipe } from '../pipes/session-worker.pipe';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SessionRehydrationExecution {
  
  private readonly SECRET = environment.appSessionSecret;
  private readonly STORAGE_KEY = environment.nameSessionKey; // Nome da key definido no environment
  
  private orchestrator = inject(SessionPipelineOrchestrator);
  private context = inject(SessionContext);

  /**
   * ESTEIRA DE REIDRATAÇÃO [PRISMO]
   * Foco: Recuperação direta do sessionStorage e sincronia via Orquestrador.
   */
  async execute(): Promise<void> {
    // [INIT] Prepara o terreno para o Interceptor atuar via Router
    this.context.setOperation(SessionTag.REHYDRATE);

    try {
      // STAGE 1: Ingestão Direta (sessionStorage)
      const rawData = sessionStorage.getItem(this.STORAGE_KEY);

      if (!rawData) {
        throw new Error(`[Prismo] Payload não encontrado na key: ${this.STORAGE_KEY}`);
      }

      // Parseamos o JSON para enviar o objeto criptografado ao Worker
      const encrypted = JSON.parse(rawData);
      console.log(`%c[Stage 1] Ingestão direta via sessionStorage OK.`, 'color: #a5b4fc');

      // STAGE 2: Processamento (Worker Pipe)
      // O Worker cuida da Porta XOR e normalização de datas
      const workerResult = await SessionWorkerPipe.process(encrypted, this.SECRET);
      
      // STAGE 3: Acorde do Contexto
      // Injetamos a sessão decodificada para disponibilizar o id_prospect ao Interceptor
      if (!workerResult.session?.id_prospect) {
        throw new Error("Falha Crítica: id_prospect ausente no WorkerResult.");
      }
      this.context.setSession(workerResult.session);
      
      console.log(`[Stage 3] Contexto reidratado localmente. Entropy: ${workerResult.density}`);

      // STAGE 4: Sincronia de Rede (Orquestrador)
      // Dispara o contrato de REHYDRATE mapeado no SessionRouter
      console.log(`%c[Stage 4] Batida de sincronia via Orquestrador...`, 'color: #6366f1');
      await this.orchestrator.executeAssignment();

      console.log(`%c[Prismo] Rehydration concluída. Estado atual: REST.`, 'color: #10b981');

    } catch (error) {
      this.handleCriticalFailure(error);
    }
  }

  /**
   * TRATAMENTO DE ERRO: Limpeza Cirúrgica
   */
  private handleCriticalFailure(err: any): void {
    console.error(`%c[Rehydrate Error] ❌ Abortando:`, 'color: #ef4444', err);
    
    // Limpeza direta do storage e reset do contexto
    sessionStorage.removeItem(this.STORAGE_KEY);
    this.context.clear(); 
  }
}
