import { Injectable, inject } from '@angular/core';
import { SessionService } from '../services/session.service';
import { SessionContext } from '../context/session.context';
import { decryptData } from '../helpers/session.helpers';
import { environment } from '../../environments/environment';
import { lastValueFrom } from 'rxjs';
import { Session } from '../models/session.model';

@Injectable({ providedIn: 'root' })
export class SessionRehydrationExecution {
  private readonly SECRET = environment.appSessionSecret;
  
  // Usando inject para manter o padrão moderno do Angular
  private service = inject(SessionService);
  private context = inject(SessionContext);

  /**
   * ESTEIRA DE REIDRATAÇÃO [PRISMO]
   * Objetivo: Acordar o contexto local e sincronizar cookies via GET.
   */
  async execute(): Promise<void> {
    try {
      // 1. Recuperação via Service (Elimina redundância de ler sessionStorage direto)
      const encrypted = this.service.getFromStorage();

      if (!encrypted) {
        throw new Error("EncryptedPayload ausente no storage.");
      }

      console.log(`%c[Rehydrate] 📦 Payload detectado. Validando veracidade...`, 'color: #a5b4fc');

      // 2. Descriptografia e Validação de Entropia
      // Passamos encrypted.payload assumindo a estrutura do seu EncryptedPayload model
      const session = await decryptData(encrypted, this.SECRET);
      await this.stageEntropyValidation(session);

      // 3. Reidratação imediata do Contexto (App destrava aqui)
      this.context.setSession(session);

      // 4. Batida de Sincronia (GET sem body para renovar cookies no Java)
      console.log(`%c[Rehydrate] 🔄 Sincronizando ciclo de vida (GET)...`, 'color: #6366f1');
      await lastValueFrom(this.service.refreshSessionCookies());

      console.log(`%c[Stage 4] Rehydration: Ciclo renovado com sucesso.`, 'color: #10b981');

    } catch (error) {
      this.handleCriticalFailure(error);
      throw error;
    }
  }

  private async stageEntropyValidation(session: Session): Promise<void> {
    const size = new Blob([JSON.stringify(session)]).size;
    const density = Math.log(size || 1);

    // Porta XOR do Prismo
    if (!(size ^ Math.floor(density)) || size === 0) {
      throw new Error("Porta XOR: Falha de integridade.");
    }

    if (!session?.id_prospect) {
      throw new Error("Conformidade: id_prospect inválido.");
    }

    console.log(`[Stage 3] Integrity: OK | Weight: ${(size/1024).toFixed(2)}kb`);
  }

  private handleCriticalFailure(err: any): void {
    console.error(`%c[Rehydrate Error] ❌ Abortando:`, 'color: #ef4444', err);
    this.service.clearStorage();
    this.context.clear();
  }
}
