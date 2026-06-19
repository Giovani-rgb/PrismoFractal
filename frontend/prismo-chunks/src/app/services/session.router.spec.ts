import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';

import { SessionRouter } from './session.router';
import { SessionTag } from '../models/session.model';
import { SessionService } from './session.service'; // Service REAL
import { SessionContext } from '../context/session.context';
import { environment } from '../../environments/environment';
import { createMockPrismoSessionState, createMockSession } from '../models/session.mocks';

describe('SessionRouter - Alinhamento com SessionService.spec', () => {
  let httpTestingController: HttpTestingController;
  let mockSessionContext: { currentState: any };
  let realService: SessionService;

  beforeEach(() => {
    mockSessionContext = {
      currentState: createMockPrismoSessionState({ data: null })
    };
  });

  afterEach(() => {
    if (httpTestingController) httpTestingController.verify();
    vi.restoreAllMocks();
    delete (window as any)._anonymousToken;
    delete (window as any)._sessionToken;
  });

  function setupRouterPipeline(interceptor: any) {
    TestBed.configureTestingModule({
      providers: [
        SessionService, // Instancia o service real
        { provide: SessionContext, useValue: mockSessionContext },
        provideHttpClient(withInterceptors(interceptor ? [interceptor] : [])),
        provideHttpClientTesting()
      ]
    });

    httpTestingController = TestBed.inject(HttpTestingController);
    realService = TestBed.inject(SessionService);
  }

  it('deve extrair a classe SessionService correta do contrato estático', () => {
    expect(SessionRouter.getServiceType()).toBe(SessionService);
  });

  describe('Validação Concorrente (Handler do Router ➡️ Método do Service ➡️ Interceptor)', () => {

    it('Pipeline PUBLIC: deve acionar executePublicAssignment e carimbar o sessionFlowInterceptor', async () => {
      const route = SessionRouter.resolvePipeline(SessionTag.PUBLIC);
      setupRouterPipeline(route?.interceptor);

      // Espionamos o método do service (o comportamento dele já é testado no session.service.spec.ts)
      const serviceSpy = vi.spyOn(realService, 'executePublicAssignment');
      (window as any)._sessionToken = 'token_flow_123';

      const mockPayload = { clientPublicKey: 'DH_KEY_ABC' };
      
      // O Router chama o handler real
      const requestPromise = firstValueFrom(route!.handler(realService, mockPayload));

      // 1. Validamos o acoplamento com o spec do Service: o método correto foi chamado?
      expect(serviceSpy).toHaveBeenCalledWith(mockPayload);

      // 2. Validamos a concorrência do Interceptor na rota disparada pelo service
      const req = httpTestingController.expectOne(`${environment.apiUrl}/api/sessions/public`);
      expect(req.request.headers.get('X-Window-Token')).toBe('token_flow_123');

      req.flush({});
      await requestPromise;
    });

    it('Pipeline CREATE: deve acionar fetchNewSession e carimbar o inboundInterceptor', async () => {
      const route = SessionRouter.resolvePipeline(SessionTag.CREATE);
      setupRouterPipeline(route?.interceptor);

      const serviceSpy = vi.spyOn(realService, 'fetchNewSession');

      const requestPromise = firstValueFrom(route!.handler(realService));

      // Alinhado com o Service Spec: garante a chamada do método delegado
      expect(serviceSpy).toHaveBeenCalled();

      // Alinhado com o Interceptor: garante os headers aplicados na rota do service
      const req = httpTestingController.expectOne(`${environment.apiUrl}/api/sessions/anonymous`);
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${environment.appSessionSecret}`);

      req.flush({});
      await requestPromise;
    });

    it('Pipeline REHYDRATE: deve acionar refreshSessionCookies e carimbar o recoveryInterceptor', async () => {
      const route = SessionRouter.resolvePipeline(SessionTag.REHYDRATE);
      
      mockSessionContext.currentState = createMockPrismoSessionState({
        data: createMockSession({ id_prospect: 'prospect_id_99' })
      });

      setupRouterPipeline(route?.interceptor);
      const serviceSpy = vi.spyOn(realService, 'refreshSessionCookies');

      const requestPromise = firstValueFrom(route!.handler(realService));

      // Confirma delegação para o método que testa os cookies/CORS lá no outro spec
      expect(serviceSpy).toHaveBeenCalled();

      // Confirma que o interceptor real leu o contexto injetado
      const req = httpTestingController.expectOne(`${environment.apiUrl}/api/sessions/refresh`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer prospect_id_99');

      req.flush({});
      await requestPromise;
    });

    it('Pipeline UPDATE: deve orquestrar s.saveToStorage(s.getFromStorage()) delegando para a persistência real', () => {
      const route = SessionRouter.resolvePipeline(SessionTag.UPDATE);
      setupRouterPipeline(route?.interceptor);

      // Espionamos a dupla dinâmica de persistência do Service
      const getSpy = vi.spyOn(realService, 'getFromStorage').mockReturnValue({ ciphertext: 'data', iv: 'iv' });
      const saveSpy = vi.spyOn(realService, 'saveToStorage');

      // Executa o handler estático do Router
      route!.handler(realService);

      // Verificamos o encadeamento lógico exato exigido pelo seu pipeline sem precisar retestar o sessionStorage do zero aqui
      expect(getSpy).toHaveBeenCalled();
      expect(saveSpy).toHaveBeenCalledWith({ ciphertext: 'data', iv: 'iv' });
    });
  });
});
