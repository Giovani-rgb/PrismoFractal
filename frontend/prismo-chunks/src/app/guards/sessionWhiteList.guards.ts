import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { SessionContext } from '../context/session.context';
import { OauthContext } from '../context/oauth.context'; // 🚀 Importação do contexto de OAuth
import { SessionPermition } from '../models/session.model';

@Injectable({ providedIn: 'root' })
export class WhitelistService {
  private readonly sessionCtx = inject(SessionContext);
  private readonly oauthCtx   = inject(OauthContext); // 🔑 Ingestão da fonte de dados consolidada do OAuth

  hasPermission(targetRoute: string, targetModule: string, isPublic: boolean): boolean {
    const currentState = this.sessionCtx.currentState;
    const permition: SessionPermition | undefined = currentState?.data?.permition;

    // 0. VALIDAÇÃO DO FLUXO CONCLUÍDO (DASHBOARD)
    // Se existir a carga consolidada de dados no 'data' do OAuth, o Dashboard é liberado de imediato
    if (this.oauthCtx.currentState.data && targetRoute === 'dashboard') {
      console.log('%c🚀 [GUARD]%c Usuário autenticado via OAuth detectado. Acesso ao Dashboard concedido.', 'color: #10b981; font-weight: bold;', '');
      return true;
    }

    // 1. CHECAGEM MESTRE: Analisa o isolamento de sessão se o objeto existir
    const rwu = permition ? permition['rwu'] : null;
    const restrictions = rwu ? rwu['restrictions'] : null;
    const isSessionIsolated = Array.isArray(restrictions) && restrictions[0] === 'isolated-session-only';

    // Se a rota for pública, liberamos direto por padrão
    if (isPublic) {
      return true; 
    }

    // 2. Validação padrão para rotas privadas (exige objeto permition ativo)
    if (!permition) return false;

    // 3. ESTEIRA DE NAVEGAÇÃO
    const navigation = permition['navigation'];
    const allowedRoutes = navigation ? navigation['allowedRoutes'] : null;
    if (!allowedRoutes || !Array.isArray(allowedRoutes) || !allowedRoutes.includes(targetRoute)) {
      return false; 
    }

    // 4. ESTEIRA DE INTERAÇÃO
    const interactions = permition['interactions'];
    const allowedModules = interactions ? interactions['allowedModules'] : null;
    if (!allowedModules || !Array.isArray(allowedModules) || !allowedModules.includes(targetModule)) {
      return false; 
    }

    return true; 
  }
}

export const whitelistGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const router = inject(Router);
  const whitelistService = inject(WhitelistService);

  const targetRoute = route.routeConfig?.path ?? '';
  const targetModule = route.data['interactionModule'] as string;
  const isPublic = !!route.data['isPublic']; // Captura a flag se ela existir

  if (whitelistService.hasPermission(targetRoute, targetModule, isPublic)) {
    return true;
  }

  return router.createUrlTree(['/unauthorized']); 
};
