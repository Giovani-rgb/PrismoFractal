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
      [SessionTag.PUBLIC, {
        tag: SessionTag.PUBLIC,
        method: 'POST',
        handler: (s, p) => s.executePublicAssignment(p ?? {}),
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
        method: 'POST',
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

  static resolvePipeline(tag: SessionTag): PipelineRoute | undefined {
    return this.routes.get(tag);
  }

  static getServiceType(): Type<SessionService> {
    return SessionService;
  }
}
