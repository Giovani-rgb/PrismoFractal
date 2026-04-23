import { Type } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';

import { SessionTag } from '../models/session.model';
import { SessionService } from './session.service';

import { 
  inboundInterceptor, 
  recoveryInterceptor,
  sessionFlowInterceptor,
  transactionInterceptor 
} from '../interceptors/session.interceptor';

export interface PipelineRoute {
  tag: SessionTag;
  method: 'POST' | 'GET' | 'PUT';
  handler: (service: SessionService, payload?: any) => any;
  interceptor?: HttpInterceptorFn; // Tornamos opcional para rotas puras
}

export class SessionRouter {
    private static readonly routes: Map<SessionTag, PipelineRoute> = new Map([
      /**
       * MÓDULO PUBLIC (HANDSHAKE)
       * Rota de infraestrutura matemática: Não possui interceptor pois
       * estabelece a segurança que os interceptores validariam depois.
       */
      [SessionTag.PUBLIC, {
        tag: SessionTag.PUBLIC,
        method: 'POST',
        // O handler aceita o payload para o callback do produto 'B'
        handler: (s, p) => s.publicHandshake(p?.B),
        interceptor: sessionFlowInterceptor 
      }],

      [SessionTag.CREATE, {
        tag: SessionTag.CREATE,
        method: 'POST',
        handler: (s) => s.fetchNewSession(),
        interceptor: inboundInterceptor 
      }],

      [SessionTag.REHYDRATE, {
        tag: SessionTag.REHYDRATE,
        method: 'POST', // Alinhado com a mudança para POST no Service/Controller
        handler: (s) => s.refreshSessionCookies(),
        interceptor: recoveryInterceptor 
      }],

      [SessionTag.UPDATE, {
        tag: SessionTag.UPDATE,
        method: 'PUT',
        handler: (s) => s.saveToStorage(s.getFromStorage()!),
        interceptor: transactionInterceptor 
      }]
    ]);

  /**
   * MÓDULO DE DELEGAÇÃO:
   * Recebe a SessionTag do Orquestrador e devolve o contrato.
   */
  static resolvePipeline(tag: SessionTag): PipelineRoute | undefined {
    return this.routes.get(tag);
  }

  static getServiceType(): Type<SessionService> {
    return SessionService;
  }
}
