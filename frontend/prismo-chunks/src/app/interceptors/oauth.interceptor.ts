import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionContext } from '../context/session.context';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { PiSdkBase } from '../../base/PiSDK.base'; 
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




/**
 * Interceptor mapeado para a aplicação capturar o método Pi.connect.
 * Injeta o Authorization Barrier accessToken quando a rota do SDK é disparada.
 */
export const piConnectInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>, 
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {

  // Monitora e age apenas se a requisição for direcionada para o SDK do Pi Network
  if (req.url.includes('socialchain.app')) {

    // Identifica o token diretamente da propriedade estática preenchida pelo handshake
    const accessToken = PiSdkBase.accessToken;

    if (accessToken) {
      return next(req.clone({
        setHeaders: {
          'Authorization': `Bearer ${accessToken}`
        }
      }));
    }
  }

  // Se não for rota do SDK ou se o token estático ainda não foi preenchido, segue adiante
  return next(req);
};

