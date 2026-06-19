import { TestBed } from '@angular/core/testing';
import { SessionContext } from './session.context'; 
import { SessionTag } from '../models/session.model'; 
import { 
  createMockSession, 
  createMockDiffieHellmanModel, 
  createMockDHResult 
} from '../models/session.mocks'; 
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';

describe('SessionContext', () => {
  let service: SessionContext;

  beforeEach(() => {
    // 🚀 SOLUÇÃO: Stub da API matchMedia para impedir quebras no construtor do service
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

    // Força o reset completo do estado anterior do TestBed do Angular
    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      providers: [SessionContext]
    });
    
    service = TestBed.inject(SessionContext);
  });

  afterEach(() => {
    if (service) {
      service.clear();
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals(); // Limpa os stubs globais (como o matchMedia) entre as suítes
  });

  it('deve ser criado com o estado inicial correto', () => {
    const state = service.currentState;

    expect(service).toBeTruthy();
    expect(state.data).toBeNull();
    expect(state.tag).toBe(SessionTag.VOID);
    expect(state.is_ready).toBe(false);
    expect(state.is_loading).toBe(false);
    expect(state.metadata).toEqual([null, null]);
  });

  describe('Fluxo de Esteira (Pipeline de Operações)', () => {
    it('deve preparar o estado ao definir uma nova operação via setOperation', () => {
      service.setOperation(SessionTag.CREATE);
      const state = service.currentState;

      expect(state.tag).toBe(SessionTag.CREATE);
      expect(state.is_loading).toBe(true);
      expect(state.is_ready).toBe(false);
    });

    it('deve estabilizar o estado em REST ao injetar a sessão via setSession', () => {
      const mockSession = createMockSession();

      service.setSession(mockSession);
      const state = service.currentState;

      expect(state.data).toEqual(mockSession);
      expect(state.tag).toBe(SessionTag.REST); 
      expect(state.is_ready).toBe(true);
      expect(state.is_loading).toBe(false);
    });
  });

  describe('Pipeline Criptográfico (Handshake Diffie-Hellman)', () => {
    it('deve estacionar o dhContext na posição 0 da tupla metadata sem apagar o dhResult', () => {
      const mockContext = createMockDiffieHellmanModel();

      service.setDHContext(mockContext);
      const state = service.currentState;

      expect(state.metadata?.[0]).toEqual(mockContext);
      expect(state.metadata?.[1]).toBeNull();
    });

    it('deve consolidar o dhResult na posição 1 da tupla metadata sem apagar o dhContext', () => {
      const mockContext = createMockDiffieHellmanModel();
      const mockResult = createMockDHResult();

      service.setDHContext(mockContext);
      service.setDHResult(mockResult);

      const state = service.currentState;

      expect(state.metadata?.[0]).toEqual(mockContext); 
      expect(state.metadata?.[1]).toEqual(mockResult);   
    });
  });

  describe('Gaveta de Segurança (Permissões)', () => {
    it('não deve fazer nada se tentar atualizar permissões sem uma sessão activa', () => {
      service.updatePermitions({ rwu: false as any } as any);

      expect(service.currentState.data).toBeNull();
      expect(service.currentPermitions).toBeNull();
    });

    it('deve atualizar cirurgicamente e mesclar as permissões sem violar os dados da sessão', () => {
      const mockSession = createMockSession({
        id_prospect: 'prospect_original',
        permition: { rwu: true, navigation: ['dashboard'] } as any
      });
      service.setSession(mockSession);

      service.updatePermitions({ navigation: ['dashboard', 'admin'], customLock: true } as any);

      const state = service.currentState;

      expect(state.data?.id_prospect).toBe('prospect_original'); 
      expect(service.currentPermitions).toEqual({
        rwu: true, 
        navigation: ['dashboard', 'admin'], 
        customLock: true 
      } as any);
    });
  });

  describe('Sensores de Rede e Reset', () => {
    it('deve reagir aos eventos nativos de online/offline da window', () => {
      service.setSession(createMockSession());

      window.dispatchEvent(new Event('offline'));
      expect(service.currentState.is_online).toBe(false);
      expect(service.currentState.schedule_requests).toBe(true);
      expect(service.currentState.tag).toBe(SessionTag.OFFLINE);

      window.dispatchEvent(new Event('online'));
      expect(service.currentState.is_online).toBe(true);
      expect(service.currentState.schedule_requests).toBe(false);
      expect(service.currentState.tag).toBe(SessionTag.REST); 
    });

    it('deve purgar o estado por completo ao chamar o método clear', () => {
      service.setSession(createMockSession());
      service.setDHContext(createMockDiffieHellmanModel());

      service.clear();
      const state = service.currentState;

      expect(state.data).toBeNull();
      expect(state.metadata).toEqual([null, null]);
      expect(state.tag).toBe(SessionTag.VOID);
      expect(state.is_ready).toBe(false);
    });
  });

  describe('Reatividade (RxJS)', () => {
    it('deve emitir o novo estado através do state$ sempre que houver mutação', async () => {
      const mockSession = createMockSession({ id_prospect: 'prospect_stream_test' });

      const nextStatePromise = firstValueFrom(
        service.state$.pipe(
          filter(state => !!state.data)
        )
      );

      service.setSession(mockSession);

      const state = await nextStatePromise;

      expect(state.data?.id_prospect).toBe('prospect_stream_test');
      expect(state.tag).toBe(SessionTag.REST);
    });
  });
});
