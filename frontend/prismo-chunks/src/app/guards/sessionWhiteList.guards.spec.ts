import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { WhitelistService, whitelistGuard } from './sessionWhiteList.guards'; // Ajuste o caminho
import { SessionContext } from '../context/session.context';
import { createMockSession } from '../models/session.mocks';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Whitelist Security Engine (Service & Guard)', () => {
  let service: WhitelistService;
  let context: SessionContext;
  let mockRouter: any;

  beforeEach(() => {
    // 🛡️ Stub global imediato antes de qualquer bootstrap do Angular
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), 
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    // Mock do Router do Angular para interceptar redirecionamentos
    mockRouter = {
      createUrlTree: vi.fn().mockImplementation((commands: string[]) => ({ tree: commands }))
    };

    // Reseta o TestBed para garantir isolamento absoluto
    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      providers: [
        WhitelistService,
        SessionContext,
        { provide: Router, useValue: mockRouter }
      ]
    });

    service = TestBed.inject(WhitelistService);
    context = TestBed.inject(SessionContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    
    // 🧹 Limpeza segura: Se o Angular segurar o contexto no loop de microtasks, o try/catch isola
    if (context) {
      try {
        context.clear();
      } catch (e) {
        // Ignora falhas de ciclo de vida tardias pós-teste
      }
    }
    
    vi.unstubAllGlobals(); 
  });

  describe('🛡️ WhitelistService - Regras de Permissão Básica', () => {
    it('deve liberar o acesso imediatamente se a rota for marcada como pública', () => {
      const allowed = service.hasPermission('login', 'auth', true);
      expect(allowed).toBe(true);
    });

    it('deve negar o acesso para rotas privadas se não houver nenhuma sessão ativa no contexto', () => {
      const allowed = service.hasPermission('dashboard', 'financial', false);
      expect(allowed).toBe(false);
    });
  });

  describe('🎛️ Esteiras de Validação Criptográfica e Permissões Avançadas', () => {
    it('deve negar o acesso se a rota privada não estiver incluída no array de allowedRoutes', () => {
      const complexSession = createMockSession({
        permition: {
          rwu: { restrictions: [] },
          navigation: { allowedRoutes: ['dashboard', 'profile'] },
          interactions: { allowedModules: ['financial'] }
        } as any
      });
      context.setSession(complexSession);

      const allowed = service.hasPermission('admin-panel', 'financial', false);
      expect(allowed).toBe(false);
    });

    it('deve negar o acesso se a rota for permitida mas o interactionModule correspondente for inválido', () => {
      const complexSession = createMockSession({
        permition: {
          rwu: { restrictions: [] },
          navigation: { allowedRoutes: ['dashboard'] },
          interactions: { allowedModules: ['core-analytics'] } 
        } as any
      });
      context.setSession(complexSession);

      const allowed = service.hasPermission('dashboard', 'financial', false);
      expect(allowed).toBe(false);
    });

    it('deve liberar com sucesso (TRUE) se o payload passar ileso por todas as esteiras estruturais', () => {
      const complexSession = createMockSession({
        permition: {
          rwu: { restrictions: [] },
          navigation: { allowedRoutes: ['dashboard'] },
          interactions: { allowedModules: ['financial'] }
        } as any
      });
      context.setSession(complexSession);

      const allowed = service.hasPermission('dashboard', 'financial', false);
      // ✅ Ajustado para a ordem correta de asserção do Vitest
      expect(allowed).toBe(true); 
    });

    it('deve analisar corretamente o isolamento de sessão se o token restrictions contiver isolated-session-only', () => {
      const complexSession = createMockSession({
        permition: {
          rwu: { restrictions: ['isolated-session-only'] },
          navigation: { allowedRoutes: ['isolated-dashboard'] },
          interactions: { allowedModules: ['secure-vault'] }
        } as any
      });
      context.setSession(complexSession);

      const allowed = service.hasPermission('isolated-dashboard', 'secure-vault', false);
      expect(allowed).toBe(true);
    });
  });

  describe('🚦 Functional Guard - whitelistGuard', () => {
    const createMockRouteSnapshot = (path: string, module: string, isPublic: boolean): ActivatedRouteSnapshot => {
      return {
        routeConfig: { path },
        data: { interactionModule: module, isPublic }
      } as unknown as ActivatedRouteSnapshot;
    };

    it('deve retornar TRUE na execução do Guard funcional se o serviço validar o acesso', () => {
      const complexSession = createMockSession({
        permition: {
          rwu: { restrictions: [] },
          navigation: { allowedRoutes: ['dashboard'] },
          interactions: { allowedModules: ['financial'] }
        } as any
      });
      context.setSession(complexSession);

      const mockRoute = createMockRouteSnapshot('dashboard', 'financial', false);
      const mockState = {} as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() => whitelistGuard(mockRoute, mockState));

      expect(result).toBe(true);
      expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
    });

    it('deve desviar a navegação gerando um UrlTree para /unauthorized caso a validação falhe', () => {
      // Executa o clear de forma isolada interna para não quebrar a árvore
      try { context.clear(); } catch(e) {}

      const mockRoute = createMockRouteSnapshot('dashboard', 'financial', false);
      const mockState = {} as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() => whitelistGuard(mockRoute, mockState));

      expect(result).toEqual({ tree: ['/unauthorized'] });
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/unauthorized']);
    });
  });
});
