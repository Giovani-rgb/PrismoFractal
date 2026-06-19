import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { encryptData, encryptJson, decryptData } from './session.helpers'; // Ajuste o caminho
import { createMockSession } from '../models/session.mocks'; // Usando sua fábrica oficial
import nodeCrypto from 'crypto';

describe('SessionHelpers - Cifragem Simétrica Nativa (AES-GCM)', () => {
  const SECRET_TEST = 'PrismoSharedSecret#2026_AES_KEY';
  const ALTERNATIVE_SECRET = 'WrongSecretKey#ForcedFailure_2026';

  beforeEach(() => {
    // 🚀 BLINDAGEM CRIPTOGRÁFICA: Mapeia o motor nativo do Node para o ambiente Web do Vitest
    if (!globalThis.crypto) {
      vi.stubGlobal('crypto', nodeCrypto.webcrypto);
    } else if (!globalThis.crypto.subtle) {
      Object.defineProperty(globalThis.crypto, 'subtle', {
        value: nodeCrypto.webcrypto.subtle,
        configurable: true,
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('🔄 Ciclo Completo: Session Data (encryptData ➡️ decryptData)', () => {

    it('deve cifrar um objeto Session real e descriptografar de volta mantendo a integridade estrutural', async () => {
      const originalSession = createMockSession({
        id_prospect: 'prospect_helper_test_123',
        country: 'BR'
      });

      // 1. Executa a cifragem real usando a API sutil da window
      const encryptedPayload = await encryptData(originalSession, SECRET_TEST);

      expect(encryptedPayload).toBeDefined();
      expect(encryptedPayload.ciphertext).toBeTypeOf('string');
      expect(encryptedPayload.iv).toBeTypeOf('string');

      // Garante que os dados confidenciais não vazaram em texto plano na string resultante
      expect(encryptedPayload.ciphertext).not.toContain('prospect_helper_test_123');

      // 2. Executa a decifragem real com o mesmo segredo
      const decryptedSession = await decryptData(encryptedPayload, SECRET_TEST);

      // Verificação atômica de igualdade estrutural profunda
      expect(decryptedSession).toEqual(originalSession);
      expect(decryptedSession.id_prospect).toBe('prospect_helper_test_123');
      expect(decryptedSession.permition?.rwu).toBe(true);
    });
  });

  describe('🔄 Ciclo Completo: JSON Genérico / Anti-Bot (encryptJson ➡️ decryptData)', () => {

    it('deve cifrar qualquer assinatura de objeto puro e decifrar com sucesso', async () => {
      const antiBotPayload = {
        refreshPassport: 'anti_bot_token_abc123',
        minWait: 45,
        status: 'PASSED'
      };

      // 1. Cifra usando o helper genérico adicionado para a reidratação/Java
      const encryptedPayload = await encryptJson(antiBotPayload, SECRET_TEST);

      // 2. Decifra usando o motor simétrico comum
      const decryptedObject = await decryptData(encryptedPayload, SECRET_TEST);

      expect(decryptedObject).toEqual(antiBotPayload);
      expect((decryptedObject as any).refreshPassport).toBe('anti_bot_token_abc123');
    });
  });

  describe('🛡️ Barreiras de Segurança e Tratamento de Falhas', () => {

    it('deve estourar erro de decifragem (OperationError) caso o segredo fornecido seja diferente do original', async () => {
      const testSession = createMockSession();

      // Cifra com a chave A
      const encryptedPayload = await encryptData(testSession, SECRET_TEST);

      // Tenta decifrar com a chave B (Cenário de chave corrompida ou ataque)
      await expect(decryptData(encryptedPayload, ALTERNATIVE_SECRET))
        .rejects
        .toThrowError(); // O Web Crypto rejeita nativamente por incompatibilidade de tag de autenticação GCM
    });

    it('deve quebrar e lançar erro se o payload contiver um IV corrompido ou Base64 inválido', async () => {
      const corruptPayload = {
        ciphertext: 'U2FsdGVkX18...',
        iv: '!!!_MOCK_IV_CORRUPTED_NOT_BASE64_!!!'
      };

      await expect(decryptData(corruptPayload, SECRET_TEST))
        .rejects
        .toThrowError(); // Falha no atob() ou no tamanho do bloco do algoritmo AES
    });
  });
});
