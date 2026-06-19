import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { OAuthService } from '../services/oauth.service';
import { OauthContext } from '../context/oauth.context';
import { SessionContext } from '../context/session.context';
import { OAuthRouter } from '../services/oauth.router';
import { lastValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OAuthPipelineOrchestrator {
  private service = inject(OAuthService);
  private oauthContext = inject(OauthContext);
  private sessionContext = inject(SessionContext); // Apenas para ler o sensor de rede global

  /**
   * GATEKEEPER (Lógica Interna do OAuth)
   */
  handleIntercept(req: HttpRequest<unknown>, next: HttpHandlerFn, injector: Injector) {
    const state = this.oauthContext.currentState;
    const route = OAuthRouter.resolvePipeline(state.tag);

    if (route?.interceptor) {
      const executeInterceptor = route.interceptor;

      return runInInjectionContext(injector, () => {
        return executeInterceptor(req, next);
      });
    }

    return next(req);
  }

  async executeAssignment(payload?: any): Promise<any> {
    const oauthState = this.oauthContext.currentState;
    const isOnline = this.sessionContext.currentState.is_online;

    if (!isOnline) {
      return Promise.reject(`[OAuthOrchestrator] Operação abortada: Dispositivo offline.`);
    }

    const route = OAuthRouter.resolvePipeline(oauthState.tag);

    if (!route) {
      throw new Error(`[OAuthOrchestrator] Falha: Tag "${oauthState.tag}" não possui contrato assinado.`);
    }

    try {
      // Execução síncrona do handler injetando o OAuthService direto
      return await lastValueFrom(route.handler(this.service, payload));
    } catch (error) {
      console.error(`%c[OAuthOrchestrator] Erro no contrato ${route.tag}:`, 'color: #f87171', error);
      throw error;
    }
  }
}

/**
 * Registro funcional exportado para o interceptor de OAuth
 */
export const oauthGatekeeper: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);

  return runInInjectionContext(injector, () => {
    const orchestrator = inject(OAuthPipelineOrchestrator);
    return orchestrator.handleIntercept(req, next, injector);
  });
};
