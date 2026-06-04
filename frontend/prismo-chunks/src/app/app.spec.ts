import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';

import { App } from './app';
import { SessionCreationExecution } from './crowdedExecultion/sessionCreat.execultion';
import { SessionRehydrationExecution } from './crowdedExecultion/sessionRehydrat.execultion';
import { SessionContext } from './context/session.context';
import { SessionCacheService } from './private/session-cache.service';
import { SessionTag, PrismoSessionState } from './models/session.model';
import { environment } from '../environments/environment';

describe('App Component - Ciclo de Vida do Ecossistema Prismo (Vitest)', () => {
  let component: App;
  let fixture: ComponentFixture<App>;

  // Mocks do Vitest usando tipagem parcial para blindagem de interface
  let mockCreationExecution: { execute: Mock };
  let mockRehydrationExecution: { execute: Mock };
  let mockContext: { clear: Mock; currentState: PrismoSessionState };
  let mockCacheService: { saveCurrentContextToVault: Mock };
  let mockRouter: { navigateByUrl: Mock; url: string };
  let mockTitleService: { setTitle: Mock };

  // Estado dinâmico que simula a memória volátil (RAM) do Prismo
  let currentMockState: PrismoSessionState;

  beforeEach(async () => {
    // 1. Inicializa as estruturas de Mock usando as funções espiãs do Vitest (vi.fn())
    mockCreationExecution = { execute: vi.fn() };
    mockRehydrationExecution = { execute: vi.fn() };
    
    // Objeto dinâmico para responder ao getter do currentState
    mockContext = {
      clear: vi.fn(),
      get currentState() { return currentMockState; }
    };
    
    mockCacheService = { saveCurrentContextToVault: vi.fn() };
    mockRouter = {
      navigateByUrl: vi.fn(),
      get url() { return '/'; }
    };
    mockTitleService = { setTitle: vi.fn() };

    // Blindagem do matchMedia global (jsdom não implementa nativamente no terminal)
    vi.stubGlobal('matchMedia', vi.fn().andReturn({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn()
    }));

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: SessionCreationExecution, useValue: mockCreationExecution },
        { provide: SessionRehydrationExecution, useValue: mockRehydrationExecution },
        { provide: SessionContext, useValue: mockContext },
        { provide: SessionCacheService, useValue: mockCacheService },
        { provide: Router, useValue: mockRouter },
        { provide: Title, useValue: mockTitleService }
      ]
    }).compileComponents();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks(); // Limpa o histórico de chamadas das funções espiãs
  });

  // =================================================================
  // ESTADO 1: DISCO VAZIO -> ROTA CREATE
  // =================================================================
  describe('ESTADO 1: Ausência de Sessão Local (Fluxo de Ingestão / CREATE)', () => {

    beforeEach(() => {
      sessionStorage.clear();
      
      currentMockState = {
        data: null,
        tag: SessionTag.VOID,
        is_ready: false,
        is_loading: false,
        is_online: true,
        schedule_requests: false,
        use_pwa_styles: false
      };

      // Simula a mutação determinística que a esteira real aplicaria
      mockCreationExecution.execute.mockImplementation(async () => {
        currentMockState.data = { id_prospect: 'prospect_novo_123' } as any;
        currentMockState.tag = SessionTag.REST;
      });

      fixture = TestBed.createComponent(App);
      component = fixture.componentInstance;
    });

    it('deve disparar a esteira de criação e processar o handshake matemático', fakeAsync(() => {
      fixture.detectChanges(); 
      expect(mockCreationExecution.execute).toHaveBeenCalledTimes(1);
      expect(mockRehydrationExecution.execute).not.toHaveBeenCalled();
      tick();
    }));

    it('deve selar o contexto em REST e persistir os novos metadados gerados no Vault Privado', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      expect(currentMockState.tag).toBe(SessionTag.REST);
      expect(mockCacheService.saveCurrentContextToVault).toHaveBeenCalledWith(environment.vaultPassword);
      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/');
    }));
  });

  // =================================================================
  // ESTADO 2: DISCO COM PAYLOAD, MAS RAM VAZIA -> ROTA REHYDRATE
  // =================================================================
  describe('ESTADO 2: Sessão no Storage, mas RAM Limpa (Fluxo de Recuperação / REHYDRATE)', () => {

    beforeEach(() => {
      sessionStorage.setItem(environment.nameSessionKey, JSON.stringify({ ciphertext: 'cifra', iv: 'iv' }));
      
      currentMockState = {
        data: null,
        tag: SessionTag.VOID,
        is_ready: false,
        is_loading: false,
        is_online: true,
        schedule_requests: false,
        use_pwa_styles: false
      };

      mockRehydrationExecution.execute.mockImplementation(async () => {
        currentMockState.data = { id_prospect: 'prospect_recuperado_456' } as any;
        currentMockState.tag = SessionTag.REST;
      });

      fixture = TestBed.createComponent(App);
      component = fixture.componentInstance;
    });

    it('deve desviar a execução para a esteira de reidratação bypassando a rota pública de criação', fakeAsync(() => {
      fixture.detectChanges();
      expect(mockRehydrationExecution.execute).toHaveBeenCalledTimes(1);
      expect(mockCreationExecution.execute).not.toHaveBeenCalled();
      tick();
    }));

    it('deve reidratar a memória volátil, sincronizar as permissões e atualizar a custódia local', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      expect(currentMockState.data?.id_prospect).toBe('prospect_recuperado_456');
      expect(mockCacheService.saveCurrentContextToVault).toHaveBeenCalledWith(environment.vaultPassword);
    }));
  });

  // =================================================================
  // ESTADO 3: SESSÃO ATIVA NA RAM -> CURTO-CIRCUITO
  // =================================================================
  describe('ESTADO 3: Sessão Totalmente Ativa na RAM (Curto-Circuito)', () => {

    beforeEach(() => {
      sessionStorage.setItem(environment.nameSessionKey, JSON.stringify({ ciphertext: 'cifra', iv: 'iv' }));
      
      currentMockState = {
        data: { id_prospect: 'prospect_ativo_789' } as any,
        tag: SessionTag.REST,
        is_ready: true,
        is_loading: false,
        is_online: true,
        schedule_requests: false,
        use_pwa_styles: false
      };

      fixture = TestBed.createComponent(App);
      component = fixture.componentInstance;
    });

    it('deve ignorar a chamada de ambas as esteiras de execução para poupar processamento e Web Workers', fakeAsync(() => {
      fixture.detectChanges();
      expect(mockCreationExecution.execute).not.toHaveBeenCalled();
      expect(mockRehydrationExecution.execute).not.toHaveBeenCalled();
      tick();
    }));

    it('deve apenas validar o posicionamento de rotas e manter a integridade intocada da RAM e do Vault', fakeAsync(() => {
      fixture.detectChanges();
      tick();

      expect(mockCacheService.saveCurrentContextToVault).not.toHaveBeenCalled();
      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/');
    }));
  });
});
