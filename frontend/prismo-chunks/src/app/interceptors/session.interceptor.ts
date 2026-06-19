import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { SessionContext } from '../context/session.context';

/**
 * Identificação via Inbound (Segredo do App)
 * Usado no início da jornada quando ainda não há dados do usuário.
 */
export const inboundInterceptor: HttpInterceptorFn = (req, next) => {
  const anonymousToken = (window as any)._anonymousToken;

  const headers: { [key: string]: string } = {
    'X-App-Id': environment.appId,
    'Authorization': `Bearer ${environment.appSessionSecret}`,
  };

  if (anonymousToken) {
    headers['X-Anonymous-Token'] = anonymousToken;
  }
  return next(req.clone({ setHeaders: headers }));
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
  const keyToken = context.currentState.data?.keyUpdate;

  return next(req.clone({
    setHeaders: {
      'Authorization': `Bearer ${keyToken}`,
    },
  }));
};

/**
 * SESSION FLOW INTERCEPTOR
 * Responsável por carimbar a identidade da App e manter a continuidade
 * do túnel criptográfico através do X-Window-Token e X-Freezer-Token.
 */
export const sessionFlowInterceptor: HttpInterceptorFn = (req, next) => {
  const context = inject(SessionContext); 
  const windowToken = (window as any)._sessionToken;
  
  const currentState = context?.currentState;
  const permition = currentState?.data?.permition;
  
  let freezerToken: string | undefined = undefined;

  // 🚀 EXTRAÇÃO SEGURA E BLINDADA DENTRO DO OBJETO NAVIGATION
  if (permition) {
    const navigation = permition['navigation'];
    // Garante que o objeto navigation está instanciado antes de checar a chave interna
    if (navigation && typeof navigation === 'object' && 'freezerToken' in navigation) {
      freezerToken = (navigation as any)['freezerToken'] as string;
    }
  }

  const headers: { [key: string]: string } = {
    'X-App-Id': environment.appId,
    'Authorization': `Bearer ${environment.appSessionSecret}`,
  };

  // Injetado após Stage 0.1: necessário para o Stage 0.2 (X-Window-Token)
  if (windowToken) {
    headers['X-Window-Token'] = windowToken;
  }

  // Adiciona o Freezer Token caso ele tenha sido localizado com sucesso
  if (freezerToken) {
    headers['X-Freezer-Token'] = freezerToken;
  }

  return next(req.clone({ setHeaders: headers }));
};
