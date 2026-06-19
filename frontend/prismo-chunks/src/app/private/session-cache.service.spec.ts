import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionCacheService } from './session-cache.service';
import { SessionContext } from '../context/session.context'; // Contexto REAL

import { 
  createMockSession, 
  createMockDiffieHellmanModel, 
  createMockDHResult 
} from '../models/session.mocks';

describe('SessionCacheService - Integração com SessionContext.spec', () => {
  let service: SessionCacheService;
  let context: SessionContext; // Instância real gerenciada pelo TestBed
  const STORAGE_KEY = '_prismo_secure_vault';
  const PASSWORD_TEST = 'PrismoSecurePass#2026';

  beforeEach(() => {
    // 🚀 RECICLADO: Exato mesmo stub global que salvou o arquivo do contexto
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

    // Força o isolamento limpando resíduos de localStorage antes de rodar cada caso
    localStorage.removeItem(STORAGE_KEY);

    // Força o reset completo do estado anterior do TestBed do Angular
    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      providers: [
        SessionCacheService,
        SessionContext // Trazemos o contexto real para a jogada
      ]
    });

    service = TestBed.inject(SessionCacheService);
    context = TestBed.inject(SessionContext);
  });

  afterEach(() => {
    // 🚀 ORDEM ESPELHO: O clear roda primeiro, enquanto o stub do matchMedia ainda está vivo!
    if (context) {
      context.clear();
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals(); // Purgamos o stub apenas no final do desmonte, igualzinho ao outro spec
    localStorage.removeItem(STORAGE_KEY);
  });

  describe('🔒 Escrita e Ofuscação (saveCurrentContextToVault)', () => {

    it('deve extrair os dados reativos do Context e persistir no vault local de forma segura', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      context.setSession(createMockSession());
      context.setDHContext(createMockDiffieHellmanModel());
      context.setDHResult(createMockDHResult());

      service.saveCurrentContextToVault(PASSWORD_TEST);

      expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEY, expect.any(String));
      expect(localStorage.getItem(STORAGE_KEY)).not.toContain('a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6');

      expect(consoleSpy).toHaveBeenCalledWith(
        '%c[SessionCache] 🔒 Vault criptografado e persistido com DHResult completo vindo de metadata.',
        'color: #818cf8; font-weight: bold;'
      );
    });

    it('deve propagar erro se o Context estiver sem uma sessão activa (.data)', () => {
      expect(() => service.saveCurrentContextToVault(PASSWORD_TEST))
        .toThrowError('[SessionCache] Não há dados ativos no contexto para persistir.');
    });

    it('deve propagar erro se a tupla metadata do Context não possuir o DHResult consolidado na posição 1', () => {
      context.setSession(createMockSession());
      context.setDHContext(createMockDiffieHellmanModel());

      expect(() => service.saveCurrentContextToVault(PASSWORD_TEST))
        .toThrowError('[SessionCache] ❌ Contrato DHResult ou sharedSecret ausentes no metadata do contexto para custódia.');
    });
  });

  describe('🔑 Leitura e Desofuscação (recoverVaultData)', () => {

    it('deve recuperar e descriptografar o payload devolvendo exatamente as chaves da fábrica oficial', () => {
      context.setSession(createMockSession({
        permition: { rwu: true, navigation: ['dashboard', 'security'], interactions: { allow_crypto_override: true } }
      }));
      context.setDHContext(createMockDiffieHellmanModel());
      context.setDHResult(createMockDHResult());

      service.saveCurrentContextToVault(PASSWORD_TEST);

      const decryptedVault = service.recoverVaultData(PASSWORD_TEST);

      expect(decryptedVault).toBeDefined();
      expect(decryptedVault?.sharedSecret).toBe('a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6');
      expect(decryptedVault?.dhResult.B).toBe('8a23c4d5e6f7a8b9c0');
      expect(decryptedVault?.permissions?.['navigation']).toContain('security');
    });

    it('deve retornar null se o cofre não existir no barramento local', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const result = service.recoverVaultData(PASSWORD_TEST);

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith('[SessionCache] 🔑 Vault não encontrado.');
    });

    it('deve repudiar a leitura se o salt da senha fornecida for inválido', () => {
      context.setSession(createMockSession());
      context.setDHContext(createMockDiffieHellmanModel());
      context.setDHResult(createMockDHResult());
      service.saveCurrentContextToVault(PASSWORD_TEST);

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = service.recoverVaultData('SENHA_ERRADA_DO_DISPOSITIVO');

      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        '[SessionCache] ❌ Falha ao ler ou decifrar o Vault (Dados corrompidos ou senha errada):',
        expect.any(Error)
      );
    });

    it('deve retornar null e silenciar a exceção se o JSON recuperado estiver malformado', () => {
      localStorage.setItem(STORAGE_KEY, btoa('{payload_corrompido_sem_fecha_chaves'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = service.recoverVaultData(PASSWORD_TEST);

      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        '[SessionCache] ❌ Falha ao ler ou decifrar o Vault (Dados corrompidos ou senha errada):',
        expect.any(Error)
      );
    });
  });

  describe('🧹 Destruição (destroyVault)', () => {
    it('deve expurgar o registro da chave estática no localStorage', () => {
      context.setSession(createMockSession());
      context.setDHContext(createMockDiffieHellmanModel());
      context.setDHResult(createMockDHResult());
      service.saveCurrentContextToVault(PASSWORD_TEST);

      service.destroyVault();

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });
});
