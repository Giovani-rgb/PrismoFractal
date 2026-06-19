import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { SessionContext } from '../context/session.context';
import { SessionPermition } from '../models/session.model';

@Injectable({ providedIn: 'root' })
export class WhitelistService {
  private readonly sessionCtx = inject(SessionContext);

  hasPermission(targetRoute: string, targetModule: string, isPublic: boolean): boolean {
    const currentState = this.sessionCtx.currentState;
    const permition: SessionPermition | undefined = currentState?.data?.permition;

    // 1. CHECAGEM MESTRE: Analisa o isolamento de sessão se o objeto existir
    const rwu = permition ? permition['rwu'] : null;
    const restrictions = rwu ? rwu['restrictions'] : null;
    const isSessionIsolated = Array.isArray(restrictions) && restrictions[0] === 'isolated-session-only';

    // Se a rota for pública, liberamos direto por padrão
    if (isPublic) {
      // Exemplo de barreira: Se a sessão for ISOLADA, você pode impedir o usuário de voltar pra Landing se quiser
      // if (isSessionIsolated && targetRoute === '') return false;
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
