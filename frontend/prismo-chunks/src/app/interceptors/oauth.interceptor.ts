import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionContext } from '../context/session.context';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

/**
 * Interceptor funcional do pipeline de OAuth.
 * Assina cegamente a requisição delegada pelo contrato do Orquestrador.
 */
export const oauthFlowInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>, 
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {

  const sessionContext = inject(SessionContext);

  // 1. Estrutura base de assinatura idêntica ao inbound vinda do environment
  const headers: { [key: string]: string } = {
    'Content-Type': 'application/json',
    'X-App-Id': environment.appId,
    'Authorization': `Bearer ${environment.appSessionSecret}`
  };

  // 2. Extração do token de passagem do escopo de RAM
  const currentPermitions = sessionContext.currentPermitions;
  const freezeToken = currentPermitions?.['navigation']?.['freezerToken'];

  if (freezeToken) {
    headers['X-Freezer-Token'] = freezeToken;
  }

  // Assina e passa adiante a rota já resolvida pelo contrato
  return next(req.clone({ setHeaders: headers }));
};
