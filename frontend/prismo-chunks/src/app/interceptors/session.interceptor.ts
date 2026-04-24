import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { SessionContext } from '../context/session.context';

/**
 * Identificação via Inbound (Segredo do App)
 * Usado no início da jornada quando ainda não há dados do usuário.
 */
export const inboundInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req.clone({
    setHeaders: {
      'Authorization': `Bearer ${environment.appSessionSecret}`,
      'X-App-Id': environment.appId,
    },
  }));
};

/**
 * Identificação via Recovery (ID do Prospect)
 * Usado para retomar sessões baseadas no ID do prospect.
 */
export const recoveryInterceptor: HttpInterceptorFn = (req, next) => {
  const context = inject(SessionContext);
  const idProspect = context.currentState.data?.id_prospect ?? undefined;

  return next(req.clone({
    setHeaders: {
      'Authorization': `Bearer ${idProspect}`,
      'X-App-Id': environment.appId,
    },
  }));
};

/**
 * Identificação via Token (Transação comum)
 * Usado para chamadas autenticadas com o token JWT.
 */
export const transactionInterceptor: HttpInterceptorFn = (req, next) => {
  const context = inject(SessionContext);
  const token = context.currentState.data?.token;

  return next(req.clone({
    setHeaders: {
      'Authorization': `Bearer ${token}`,
    },
  }));
};

/**
 * SESSION FLOW INTERCEPTOR
 * Responsável por carimbar a identidade da App e manter a continuidade
 * do túnel criptográfico através do X-Window-Token.
 */
export const sessionFlowInterceptor: HttpInterceptorFn = (req, next) => {
  
  // Recupera o token diretamente da memória global (atalho rápido)
  const windowToken = (window as any)._sessionToken;

  // Montagem dos headers base (Contrato de Infra)
  const headers: { [key: string]: string } = {
    'X-App-Id': environment.appId,
    'Authorization': `Bearer ${environment.appSessionSecret}`,
  };

  // Injeção dinâmica da flag após a primeira interação (Stage 0.1)
  if (windowToken) {
    headers['X-Window-Token'] = windowToken;
  }

  // Clona a requisição com os novos headers
  const authorizedReq = req.clone({ setHeaders: headers });

  return next(authorizedReq);
};
