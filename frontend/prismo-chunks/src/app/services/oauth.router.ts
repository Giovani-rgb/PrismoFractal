import { Type } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';

import { OAuthTag } from '../models/oauth.model';

import { OAuthService } from './oauth.service';
import { oauthFlowInterceptor, piConnectInterceptor } from '../interceptors/oauth.interceptor'; // Importando ambos do mesmo arquivo

export interface OAuthPipelineRoute {
  tag: OAuthTag;
  method: 'POST' | 'GET' | 'PUT';
  handler: (service: OAuthService, payload?: any) => any;
  interceptor?: HttpInterceptorFn;
}

export class OAuthRouter {
  private static readonly routes: Map<OAuthTag, OAuthPipelineRoute> = new Map([

    /**
     * CONTRATO 1: OPERAÇÃO VOID
     * Estado de inicialização ou neutralização de falhas. 
     * esta rota também recebe serviço requestOAuthAuthorization
     * e o interceptor oauthFlowInterceptor
     */
    [OAuthTag.VOID, {
      tag: OAuthTag.VOID,
      method: 'POST',
      handler: (service, payload) => service.requestOAuthAuthorization(payload ?? {}),
      interceptor: oauthFlowInterceptor
    }],

    /**
     * CONTRATO 2: OPERAÇÃO OAUTH
     * Dispara o payload cifrado pelo Web Worker para a rota dedicada backend,
     * aplicando o interceptor para validação de cabeçalhos.
     * nesta função o service que devia usar eh o do authenticateWithPiNetwork
     */
    [OAuthTag.OAUTH, {
      tag: OAuthTag.OAUTH,
      method: 'POST',
      handler: (service, payload) => service.authenticateWithPiNetwork(payload ?? {}),
      interceptor: oauthFlowInterceptor
    }],

    /**
     * CONTRATO 3: SDK PROFILE (GET https://socialchain.app/v2/me)
     * Mapeado para quando a aplicação chamar o Pi.connect.
     * Retorna uma Promise resolvida pelo HttpClient.
     */
    [OAuthTag.SDK_PROFILE, {
      tag: OAuthTag.SDK_PROFILE,
      method: 'GET',
      handler: (service) => service.getSdkProfile(),
      interceptor: piConnectInterceptor
    }],

    /**
     * CONTRATO 4: SDK TRACK (POST track)
     * Rota genérica de telemetria/analytics disparada de forma assíncrona pelo SDK.
     */
    [OAuthTag.SDK_TRACK, {
      tag: OAuthTag.SDK_TRACK,
      method: 'POST',
      handler: (service, payload) => service.trackSdkEvent(payload ?? {}),
      interceptor: piConnectInterceptor
    }]

  ]);

  /**
   * Resolve o contrato da esteira com base na tag ativa
   */
  static resolvePipeline(tag: OAuthTag): OAuthPipelineRoute | undefined {
    return this.routes.get(tag);
  }

  /**
   * Expõe o token de serviço para o injector do Orquestrador
   */
  static getServiceType(): Type<OAuthService> {
    return OAuthService;
  }
}
