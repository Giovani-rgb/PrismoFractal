import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionWorkerPipe } from './session-worker.pipe';
import { 
  createMockDiffieHellmanModel, 
  createMockDHResult, 
  createMockEncryptedPayload 
} from '../models/session.mocks';

describe('SessionWorkerPipe - Pipelines em Web Workers', () => {
  let mockWorkerInstance: any;

  beforeEach(() => {
    // Stub da URL nativa para evitar que o construtor do Worker quebre no Node/Vitest
    vi.stubGlobal('URL', vi.fn().mockImplementation((path) => ({ href: path })));

    // Mock estruturado da instância do Worker nativo
    mockWorkerInstance = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
    };

    // Substitui o construtor global do Worker da Window
    vi.stubGlobal('Worker', vi.fn().mockImplementation(() => mockWorkerInstance));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('STAGE 1: stage_dh', () => {
    it('deve postar a ação STAGE_DH e resolver com o modelo de chaves gerado', async () => {
      const mockParams = { p: 'FFFFC90FDAA2', g: '02' };
      const mockModel = createMockDiffieHellmanModel();

      const promise = SessionWorkerPipe.stage_dh(mockParams);

      expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
        action: 'STAGE_DH',
        p: mockParams.p,
        g: mockParams.g
      });

      mockWorkerInstance.onmessage({ data: { success: true, ...mockModel } });

      const result = await promise;
      expect(result).toEqual(mockModel);
      expect(mockWorkerInstance.terminate).toHaveBeenCalled();
    });

    it('deve rejeitar a promessa se o Worker retornar uma falha interna na geração das chaves', async () => {
      const promise = SessionWorkerPipe.stage_dh({ p: 'invalid', g: '00' });

      mockWorkerInstance.onmessage({ data: { success: false, error: 'Erro de Primalidade' } });

      await expect(promise).rejects.toBe('Erro de Primalidade');
      expect(mockWorkerInstance.terminate).toHaveBeenCalled();
    });
  });

  describe('STAGE 2: calculateDH', () => {
    it('deve postar a ação HANDSHAKE enviando a chave A pública do servidor e resolver o DHResult', async () => {
      const serverA = 'SERVER_KEY_A_123';
      const clientContext = createMockDiffieHellmanModel();
      const mockResult = createMockDHResult();

      const promise = SessionWorkerPipe.calculateDH(serverA, clientContext);

      expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
        action: 'HANDSHAKE',
        A: serverA,
        ...clientContext
      });

      mockWorkerInstance.onmessage({ data: { success: true, ...mockResult } });

      const result = await promise;
      expect(result).toEqual(mockResult);
    });
  });

  describe('FASE 4: encryptJson', () => {
    it('deve postar a ação ENCRYPT_JSON e retornar o EncryptedPayload (ciphertext + iv)', async () => {
      const mockJson = { id_prospect: 'prospect_99', ts: 1717934400000 };
      const sharedSecret = 'secret_aes_gcm';
      const mockEncrypted = createMockEncryptedPayload();

      const promise = SessionWorkerPipe.encryptJson(mockJson, sharedSecret);

      expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
        action: 'ENCRYPT_JSON',
        payload: mockJson,
        secret: sharedSecret
      });

      mockWorkerInstance.onmessage({ data: { success: true, ...mockEncrypted } });

      const result = await promise;
      expect(result).toEqual(mockEncrypted);
    });
  });

  describe('STAGE 3: process (Legado)', () => {
    it('deve despachar a ação PROCESS_SESSION e retornar o resultado descriptografado intacto', async () => {
      const mockRaw = createMockEncryptedPayload();
      const sharedSecret = 'secret_aes_gcm';
      const expectedLegacyResult = { success: true, old_session_id: '123' };

      const promise = SessionWorkerPipe.process(mockRaw, sharedSecret);

      expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
        action: 'PROCESS_SESSION',
        raw: mockRaw,
        secret: sharedSecret
      });

      mockWorkerInstance.onmessage({ data: expectedLegacyResult });

      const result = await promise;
      expect(result).toEqual(expectedLegacyResult);
    });
  });

  describe('MÉTODO NOVO: decryptJson (Decifragem Pura Anti-Bot)', () => {
    it('deve postar a ação DECRYPT_JSON e extrair a propriedade .decrypted prioritariamente se ela existir', async () => {
      const mockRaw = createMockEncryptedPayload();
      const sharedSecret = 'secret_aes_gcm';
      const antiBotPayload = { refreshPassport: 'pass_abc', minWait: 30, status: 'OK' };

      const promise = SessionWorkerPipe.decryptJson(mockRaw, sharedSecret);

      expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
        action: 'DECRYPT_JSON',
        raw: mockRaw,
        secret: sharedSecret
      });

      mockWorkerInstance.onmessage({ data: { success: true, decrypted: antiBotPayload } });

      const result = await promise;
      expect(result).toEqual(antiBotPayload);
    });

    it('deve retornar o payload de dados completo caso a propriedade .decrypted não venha isolada', async () => {
      const mockRaw = createMockEncryptedPayload();
      const sharedSecret = 'secret_aes_gcm';
      const fallbackPayload = { success: true, directData: 'value' };

      const promise = SessionWorkerPipe.decryptJson(mockRaw, sharedSecret);

      mockWorkerInstance.onmessage({ data: fallbackPayload });

      const result = await promise;
      expect(result).toEqual(fallbackPayload);
    });

    it('deve rejeitar o fluxo se o pipeline do worker disparar a captura nativa do onerror', async () => {
      const mockRaw = createMockEncryptedPayload();
      const promise = SessionWorkerPipe.decryptJson(mockRaw, 'secret');

      // Simulação fiel do objeto de erro que o barramentoonerror do worker propaga
      const mockErrorEvent = {
        message: 'Falha de alocação de memória no Worker',
        filename: 'session.worker.ts',
        lineno: 42
      };

      // Dispara o gatilho passando o evento simulado
      mockWorkerInstance.onerror(mockErrorEvent);

      // ✅ CORREÇÃO CIRÚRGICA: Valida o payload rejeitado de forma flexível e segura
      await expect(promise).rejects.toEqual(mockErrorEvent);
      expect(mockWorkerInstance.terminate).toHaveBeenCalled();
    });
  });
});
