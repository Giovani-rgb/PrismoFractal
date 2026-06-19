import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Session } from '../models/session.model';
import { 
  createMockSession,
  createMockDiffieHellmanModel, 
  createMockDHResult, 
  createMockEncryptedPayload 
} from '../models/session.mocks'; // Fábricas oficiais e centralizadas

// 1. ISOLAMENTO ABSOLUTO: Mock estruturado dos helpers utilizando as suas fábricas oficiais
vi.mock('../helpers/session.helpers', () => ({
  decryptData: vi.fn(),
  encryptJson: vi.fn().mockImplementation(() => Promise.resolve({
    ciphertext: 'U2FsdGVkX18vY3VycmVudF9zZXNzaW9uX2VuY3J5cHRlZF9ieV9hZXNfZ2NtX21vY2s=',
    iv: 'd3NmaGtkYWg4OTMyaGE='
  })) // Retorna a estrutura exata do seu createMockEncryptedPayload() por padrão
}));

import { decryptData, encryptJson } from '../helpers/session.helpers';

describe('Web Worker - session.worker.ts (Fogo Concentrado no Fluxo)', () => {
  let workerListener: (event: { data: any }) => Promise<void>;

  beforeEach(async () => {
    // 2. Emulação do ambiente isolado do Worker
    vi.stubGlobal('postMessage', vi.fn());

    vi.stubGlobal('crypto', {
      getRandomValues: vi.fn().mockImplementation((buffer: Uint8Array) => {
        buffer.fill(0x01); // Bytes previsíveis para cálculo determinístico do BigInt
        return buffer;
      })
    });

    vi.stubGlobal('addEventListener', vi.fn().mockImplementation((type, listener) => {
      if (type === 'message') {
        workerListener = listener;
      }
    }));

    await import('./session.worker'); 
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules(); 
  });

  describe('🔥 FASE 1: STAGE_DH (Aritmética Modular)', () => {
    it('deve receber parâmetros, gerar chaves modulares via BigInt e responder com o DiffieHellmanModel', async () => {
      const mockDH = createMockDiffieHellmanModel();
      const messageEvent = {
        data: { action: 'STAGE_DH', p: mockDH.p, g: mockDH.g }
      };

      await workerListener(messageEvent);

      expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        p: mockDH.p,
        g: mockDH.g,
        _b: expect.any(String),
        B: expect.any(String)
      }));

      const response = vi.mocked(postMessage).mock.calls[0][0];
      expect(response._b).toMatch(/^[0-9a-f]+$/);
      expect(response.B).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('🤝 FASE 2: HANDSHAKE (Matemática do Segredo Compartilhado)', () => {
    it('deve processar o handshake executando S = A^_b mod p e retornar o DHResult oficial', async () => {
      const mockDH = createMockDiffieHellmanModel();
      const messageEvent = {
        data: {
          action: 'HANDSHAKE',
          A: '8a23c4d5e6f7a8b9c0', 
          ...mockDH
        }
      };

      await workerListener(messageEvent);

      expect(postMessage).toHaveBeenCalledWith({
        success: true,
        B: expect.any(String),
        sharedSecret: expect.any(String),
        _b: mockDH._b
      });
    });

    it('deve barrar a execução se a chave privada _b for omitida do payload', async () => {
      const mockDH = createMockDiffieHellmanModel({ _b: undefined });
      const messageEvent = {
        data: { action: 'HANDSHAKE', A: '8a23c4', ...mockDH }
      };

      await workerListener(messageEvent);

      expect(postMessage).toHaveBeenCalledWith({
        success: false,
        error: 'Handshake abortado: Chave privada primária (_b) ausente no contexto enviado.'
      });
    });
  });

  describe('🛡️ FASE 3: PROCESS_SESSION (Normalizações e Barreira Porta XOR)', () => {
    it('deve reidratar arrays do Java LocalDateTime usando createMockSession e passar na Porta XOR', async () => {
      const mockRaw = createMockEncryptedPayload();
      
      // Ajusta as propriedades de data para simular a chegada do array numérico do Java
      const sessionWithJavaDates = createMockSession({
        createdAt: [2026, 6, 9, 10, 15, 0, 0] as any,
        expiresAt: [2026, 6, 9, 12, 15, 0, 0] as any,
        lastAccessAt: [2026, 6, 9, 10, 15, 0, 0] as any
      });

      vi.mocked(decryptData).mockResolvedValue(sessionWithJavaDates);

      await workerListener({ data: { action: 'PROCESS_SESSION', raw: mockRaw, secret: 'secret' } });

      expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        session: expect.objectContaining({
          id_prospect: 'prospect_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 
          createdAt: expect.any(Number), 
          expiresAt: expect.any(Number)
        }),
        weight: expect.any(String),
        density: expect.any(String)
      }));
    });

    it('deve estourar erro da Porta XOR se o payload descriptografado violar a consistência (sem id_prospect)', async () => {
      const mockRaw = createMockEncryptedPayload();
      
      // Força a quebra omitindo o id_prospect da fábrica oficial
      vi.mocked(decryptData).mockResolvedValue(createMockSession({ id_prospect: undefined }));

      await workerListener({ data: { action: 'PROCESS_SESSION', raw: mockRaw, secret: 'secret' } });

      expect(postMessage).toHaveBeenCalledWith({
        success: false,
        error: 'Porta XOR: Quebra de veracidade ou payload corrompido.'
      });
    });
  });

  describe('📦 FASE 4: ENCRYPT_JSON (Reidratação de Identificação)', () => {
    it('deve encapsular o payload chamando o helper e postar o EncryptedPayload oficial', async () => {
      const identificationPayload = { id_prospect: 'prospect_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', ts: 1717934400000 };
      const mockEncrypted = createMockEncryptedPayload();
      
      vi.mocked(encryptJson).mockResolvedValue(mockEncrypted);

      await workerListener({ 
        data: { action: 'ENCRYPT_JSON', payload: identificationPayload, secret: 'secret' } 
      });

      expect(encryptJson).toHaveBeenCalledWith(identificationPayload, 'secret');
      expect(postMessage).toHaveBeenCalledWith({
        success: true,
        ...mockEncrypted
      });
    });
  });

    describe('🤖 FASE 5: DECRYPT_JSON (Anti-Bot Generics)', () => {
    it('deve descriptografar e retornar os dados purificados dentro da propriedade decrypted', async () => {
      const mockRaw = createMockEncryptedPayload();
      const antiBotResponse = { refreshPassport: 'k_upd_883fa092cb', minWait: 15, status: 'OK' };
      
      // 🚀 SOLUÇÃO: Força o Typecast para Session apenas para o Vitest aceitar o mock de dados genéricos
      vi.mocked(decryptData).mockResolvedValue(antiBotResponse as unknown as Session);

      await workerListener({ 
        data: { action: 'DECRYPT_JSON', raw: mockRaw, secret: 'secret' } 
      });

      expect(decryptData).toHaveBeenCalledWith(mockRaw, 'secret');
      expect(postMessage).toHaveBeenCalledWith({
        success: true,
        decrypted: antiBotResponse
      });
    });
  });


  describe('🚧 FASE DE BORDA: Proteções de Carga', () => {
    it('deve estourar o gatilho padrão do catch caso venha uma ação não cadastrada', async () => {
      await workerListener({ data: { action: 'ACAO_DESCONHECIDA' } });

      expect(postMessage).toHaveBeenCalledWith({
        success: false,
        error: 'Ação criptográfica desconhecida na esteira: ACAO_DESCONHECIDA'
      });
    });
  });
});
