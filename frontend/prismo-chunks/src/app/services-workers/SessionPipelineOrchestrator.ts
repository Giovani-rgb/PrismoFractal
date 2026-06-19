import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
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
   * Recebe o injector para garantir que contratos do SessionRouter rodem em contexto seguro
   */
  handleIntercept(req: HttpRequest<unknown>, next: HttpHandlerFn, injector: Injector) {
    const state = this.context.currentState;
    const route = SessionRouter.resolvePipeline(state.tag);

    if (route?.interceptor) {
      // 🚀 EXTRAÇÃO CIRÚRGICA: Isolamos a função pura do objeto para limpar o 'this' corrompido do JavaScript
      const executeInterceptor = route.interceptor;

      return runInInjectionContext(injector, () => {
        // Executa a função de forma isolada do objeto 'route'
        return executeInterceptor(req, next);
      });
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
 */
export const sessionGatekeeper: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);

  return runInInjectionContext(injector, () => {
    const orchestrator = inject(SessionPipelineOrchestrator);
    // Passamos o injector para blindar as sub-chamadas do SessionRouter
    return orchestrator.handleIntercept(req, next, injector);
  });
};
