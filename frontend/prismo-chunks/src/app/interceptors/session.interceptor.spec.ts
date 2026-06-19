import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { SessionContext } from '../context/session.context';
import { createMockPrismoSessionState, createMockSession } from '../models/session.mocks';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { 
  inboundInterceptor, 
  recoveryInterceptor, 
  transactionInterceptor, 
  sessionFlowInterceptor 
} from './session.interceptor'; // Ajuste o caminho

describe('Session Interceptors', () => {
  let httpTestingController: HttpTestingController;

  // Criamos um mock para o SessionContext que permite injetar estados customizados dinamicamente
  let mockSessionContext: { currentState: any };

  beforeEach(() => {
    mockSessionContext = {
      currentState: createMockPrismoSessionState({ data: null })
    };
  });

  afterEach(() => {
    // Garante que não sobrou nenhum request pendente e limpa mutações globais na window
    if (httpTestingController) httpTestingController.verify();
    delete (window as any)._anonymousToken;
    delete (window as any)._sessionToken;
  });

  /**
   * Helper reutilizável para configurar o injetor do Angular com o interceptor específico
   */
  function setupInterceptor(interceptor: any) {
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionContext, useValue: mockSessionContext },
        provideHttpClient(withInterceptors([interceptor])),
        provideHttpClientTesting()
      ]
    });

    const httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
    return httpClient;
  }

  describe('inboundInterceptor', () => {
    it('deve carimbar os headers base de AppId e Secret de ambiente', async () => {
      const client = setupInterceptor(inboundInterceptor);

      firstValueFrom(client.get('/test')).catch(() => {});

      const req = httpTestingController.expectOne('/test');
      expect(req.request.headers.get('X-App-Id')).toBe(environment.appId);
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${environment.appSessionSecret}`);
      expect(req.request.headers.has('X-Anonymous-Token')).toBe(false);
    });

    it('deve incluir o X-Anonymous-Token de forma condicional se ele existir na window', async () => {
      (window as any)._anonymousToken = 'anon_token_123';
      const client = setupInterceptor(inboundInterceptor);

      firstValueFrom(client.get('/test')).catch(() => {});

      const req = httpTestingController.expectOne('/test');
      expect(req.request.headers.get('X-Anonymous-Token')).toBe('anon_token_123');
    });
  });

  describe('recoveryInterceptor', () => {
    it('deve injetar o id_prospect do contexto ativo no cabeçalho Authorization', async () => {
      // Configura o mock do contexto com dados de sessão válidos
      mockSessionContext.currentState = createMockPrismoSessionState({
        data: createMockSession({ id_prospect: 'prospect_recovery_test_99' })
      });

      const client = setupInterceptor(recoveryInterceptor);
      firstValueFrom(client.get('/test')).catch(() => {});

      const req = httpTestingController.expectOne('/test');
      expect(req.request.headers.get('Authorization')).toBe('Bearer prospect_recovery_test_99');
      expect(req.request.headers.get('X-App-Id')).toBe(environment.appId);
    });

    it('deve lidar com id_prospect ausente injetando "Bearer undefined"', async () => {
      mockSessionContext.currentState = createMockPrismoSessionState({ data: null });

      const client = setupInterceptor(recoveryInterceptor);
      firstValueFrom(client.get('/test')).catch(() => {});

      const req = httpTestingController.expectOne('/test');
      expect(req.request.headers.get('Authorization')).toBe('Bearer undefined');
    });
  });

  describe('transactionInterceptor', () => {
    it('deve carimbar o Authorization usando a propriedade keyUpdate da sessão', async () => {
      mockSessionContext.currentState = createMockPrismoSessionState({
        data: createMockSession({ keyUpdate: 'k_upd_vitest_token' })
      });

      const client = setupInterceptor(transactionInterceptor);
      firstValueFrom(client.get('/test')).catch(() => {});

      const req = httpTestingController.expectOne('/test');
      expect(req.request.headers.get('Authorization')).toBe('Bearer k_upd_vitest_token');
    });
  });

  describe('sessionFlowInterceptor', () => {
    it('deve injetar apenas as credenciais de aplicação por padrão se tokens não existirem', async () => {
      mockSessionContext.currentState = createMockPrismoSessionState({
        data: createMockSession({ permition: {} }) // Sem freezerToken nas permissões
      });

      const client = setupInterceptor(sessionFlowInterceptor);
      firstValueFrom(client.get('/test')).catch(() => {});

      const req = httpTestingController.expectOne('/test');
      expect(req.request.headers.get('X-App-Id')).toBe(environment.appId);
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${environment.appSessionSecret}`);
      expect(req.request.headers.has('X-Window-Token')).toBe(false);
      expect(req.request.headers.has('X-Freezer-Token')).toBe(false);
    });

    it('deve carimbar cirurgicamente os cabeçalhos X-Window-Token e X-Freezer-Token se estiverem disponíveis', async () => {
      // Configura tokens na window e na gaveta profunda de permissões do context mockado
      (window as any)._sessionToken = 'window_session_abc';

      mockSessionContext.currentState = createMockPrismoSessionState({
        data: createMockSession({
          permition: {
            navigation: { freezerToken: 'freezer_secure_9921' }
          }
        })
      });

      const client = setupInterceptor(sessionFlowInterceptor);
      firstValueFrom(client.get('/test')).catch(() => {});

      const req = httpTestingController.expectOne('/test');
      expect(req.request.headers.get('X-Window-Token')).toBe('window_session_abc');
      expect(req.request.headers.get('X-Freezer-Token')).toBe('freezer_secure_9921');
      expect(req.request.headers.get('X-App-Id')).toBe(environment.appId);
    });
  });
});
