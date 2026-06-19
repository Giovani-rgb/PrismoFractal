import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpRequest, HttpHandlerFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Injector } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { firstValueFrom, of, throwError } from 'rxjs';

import { SessionPipelineOrchestrator, sessionGatekeeper } from './SessionPipelineOrchestrator'; 
import { SessionService } from '../services/session.service';
import { SessionContext } from '../context/session.context';
import { SessionRouter } from '../services/session.router';
import { SessionTag } from '../models/session.model';
import { createMockPrismoSessionState } from '../models/session.mocks';

describe('SessionPipelineOrchestrator - Integração de Fluxos', () => {
  let orchestrator: SessionPipelineOrchestrator;
  let httpTestingController: HttpTestingController;
  let injector: Injector; // ✅ Armazena a referência do Injector do TestBed

  // Mocks estruturados para as dependências do TestBed
  let mockSessionContext: { currentState: any };
  let mockSessionService: any;

  beforeEach(() => {
    // 🚀 Reseta a engine do TestBed para garantir isolamento total e purga de tokens antigos
    TestBed.resetTestingModule();

    // Estado base: Dispositivo Online e pronto para inicializar o fluxo de testes
    mockSessionContext = {
      currentState: createMockPrismoSessionState({ tag: SessionTag.CREATE, is_online: true })
    };

    mockSessionService = {};

    TestBed.configureTestingModule({
      providers: [
        SessionPipelineOrchestrator,
        { provide: SessionContext, useValue: mockSessionContext },
        { provide: SessionService, useValue: mockSessionService },
        provideHttpClient(withInterceptors([sessionGatekeeper])),
        provideHttpClientTesting()
      ]
    });

    orchestrator = TestBed.inject(SessionPipelineOrchestrator);
    httpTestingController = TestBed.inject(HttpTestingController);
    injector = TestBed.inject(Injector); // ✅ Captura o injetor do ambiente de testes
  });

  afterEach(() => {
    httpTestingController.verify();
    vi.restoreAllMocks();
  });

  describe('🛡️ Gatekeeper Interceptor (handleIntercept)', () => {
    it('deve repassar a requisição intocada se a Tag atual não possuir interceptor assinado', () => {
      mockSessionContext.currentState.tag = SessionTag.VOID;

      const mockReq = new HttpRequest('GET', '/api/pure-route');
      const mockNext = vi.fn(() => of({})) as unknown as HttpHandlerFn;

      // ✅ CORREÇÃO: Passando o terceiro argumento (injector) exigido pelo orquestrador
      orchestrator.handleIntercept(mockReq, mockNext, injector);

      expect(mockNext).toHaveBeenCalledWith(mockReq);
    });

    it('deve invocar e desviar o fluxo para o interceptor específico determinado pelo SessionRouter', () => {
      mockSessionContext.currentState.tag = SessionTag.PUBLIC;
      const pipelineRoute = SessionRouter.resolvePipeline(SessionTag.PUBLIC);

      expect(pipelineRoute?.interceptor).toBeDefined();
      const interceptorSpy = vi.spyOn(pipelineRoute!, 'interceptor');

      const mockReq = new HttpRequest('POST', '/api/sessions/public');
      const mockNext = vi.fn(() => of({})) as unknown as HttpHandlerFn;

      // ✅ CORREÇÃO: Passando o terceiro argumento (injector) exigido pelo orquestrador
      orchestrator.handleIntercept(mockReq, mockNext, injector);

      expect(interceptorSpy).toHaveBeenCalledWith(mockReq, mockNext);
    });
  });

  describe('🚀 Esteira de Execução (executeAssignment)', () => {
    it('deve rejectionar imediatamente a Promise se o sensor de rede indicar dispositivo offline', async () => {
      mockSessionContext.currentState.is_online = false;

      await expect(orchestrator.executeAssignment({}))
        .rejects
        .toBe('[Orchestrator] Operação abortada: Dispositivo offline.');
    });

    it('deve estourar um erro se a Tag ativa no contexto não possuir uma rota mapeada no Router', async () => {
      mockSessionContext.currentState.tag = 'TAG_BARRADA_INEXISTENTE' as any;

      await expect(orchestrator.executeAssignment({}))
        .rejects
        .toThrowError('[Orchestrator] Falha: Tag "TAG_BARRADA_INEXISTENTE" não possui contrato assinado.');
    });

    it('deve resolver o fluxo com sucesso executando o handler real do Router e capturando o lastValueFrom', async () => {
      mockSessionContext.currentState.tag = SessionTag.CREATE;
      const pipelineRoute = SessionRouter.resolvePipeline(SessionTag.CREATE);

      const mockBackendResponse = { token: 'session_token_sucesso_123' };
      const handlerSpy = vi.spyOn(pipelineRoute!, 'handler').mockReturnValue(of(mockBackendResponse));

      const resultPromise = orchestrator.executeAssignment({ dados: 'payload_exemplo' });

      expect(handlerSpy).toHaveBeenCalledWith(mockSessionService, { dados: 'payload_exemplo' });

      const result = await resultPromise;
      expect(result).toEqual(mockBackendResponse);
    });

    it('deve logar no console com formatação de erro e propagar a falha caso o pipeline do service estoure', async () => {
      mockSessionContext.currentState.tag = SessionTag.CREATE;
      const pipelineRoute = SessionRouter.resolvePipeline(SessionTag.CREATE);

      const mockError = new Error('Falha crítica de barramento/rede');
      vi.spyOn(pipelineRoute!, 'handler').mockReturnValue(throwError(() => mockError));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(orchestrator.executeAssignment({}))
        .rejects
        .toThrowError('Falha crítica de barramento/rede');

      expect(consoleSpy).toHaveBeenCalledWith(
        `%c[Orchestrator] Erro no contrato ${pipelineRoute?.tag}:`,
        'color: #f87171',
        mockError
      );
    });
  });

  describe('🌐 Teste de Integração de Fluxo HTTP via sessionGatekeeper', () => {
    it('deve fazer o gatekeeper atuar de forma transparente na requisição HTTP padrão', async () => {
      mockSessionContext.currentState.tag = SessionTag.CREATE;

      const httpClient = TestBed.inject(HttpClient);
      firstValueFrom(httpClient.get('/api/any-route')).catch(() => {});

      const req = httpTestingController.expectOne('/api/any-route');
      expect(req.request.headers).toBeDefined();

      req.flush({});
    });
  });
});

