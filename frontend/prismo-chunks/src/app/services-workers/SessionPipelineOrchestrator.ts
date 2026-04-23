import { Injectable, inject } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { SessionService } from '../services/session.service';
import { SessionContext } from '../context/session.context';
import { SessionRouter } from '../services/session.router';
import { lastValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SessionPipelineOrchestrator {
  private service = inject(SessionService);
  private context = inject(SessionContext);

  /**
   * GATEKEEPER (Lógica Interna)
   * Agora como um método de classe para garantir o acesso ao 'this.context'
   */
  handleIntercept(req: HttpRequest<unknown>, next: HttpHandlerFn) {
    const state = this.context.currentState;
    const route = SessionRouter.resolvePipeline(state.tag);

    // Se o contrato possuir um interceptor específico (ex: injetar Headers de Session)
    if (route?.interceptor) {
      return route.interceptor(req, next);
    }

    return next(req);
  }

  async executeAssignment(payload?: any): Promise<any> {
    const state = this.context.currentState;

    if (!state.is_online) {
      return Promise.reject(`[Orchestrator] Operação abortada: Dispositivo offline.`);
    }

    const route = SessionRouter.resolvePipeline(state.tag);

    if (!route) {
      throw new Error(`[Orchestrator] Falha: Tag "${state.tag}" não possui contrato assinado.`);
    }

    try {
      // Execução do handler definido no SessionRouter
      return await lastValueFrom(route.handler(this.service, payload));
    } catch (error) {
      console.error(`%c[Orchestrator] Erro no contrato ${route.tag}:`, 'color: #f87171', error);
      throw error;
    }
  }
}

/**
 * Registro funcional exportado para o provideHttpClient
 * Esta função precisa ser pura e injetar o orquestrador no momento da execução.
 */
export const sessionGatekeeper: HttpInterceptorFn = (req, next) => {
  const orchestrator = inject(SessionPipelineOrchestrator);
  return orchestrator.handleIntercept(req, next);
};
