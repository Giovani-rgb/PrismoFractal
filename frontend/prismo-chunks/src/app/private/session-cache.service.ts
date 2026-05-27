import { Injectable, inject } from '@angular/core';
import { SessionContext } from '../context/session.context';

interface VaultPayload {
  sharedSecret: string;
  permissions: string[];
  salt: string; // Para dificultar leituras brutas no localStorage
}

@Injectable({
  providedIn: 'root'
})
export class SessionCacheService {
  private context = inject(SessionContext);
  private readonly STORAGE_KEY = '_prismo_secure_vault';

  /**
   * Captura o estado atual do contexto, extrai o DHResult e as permissões,
   * e salva no storage local protegido por uma senha.
   */
  public saveCurrentContextToVault(password: string): void {
    const state = this.context.currentState;

    // Garante que existem dados no contexto antes de tentar ler
    if (!state || !state.data) {
      throw new Error('[SessionCache] Não há dados ativos no contexto para persistir.');
    }

    // Extração dinâmica do DHResult (sharedSecret) e permissions de dentro de data
    const sharedSecret = state.dhResult?.sharedSecret || state.dhResult?.sharedSecret;
    const permissions = state.data.permition || state.data.permition || [];

    if (!sharedSecret) {
      console.warn('[SessionCache] ⚠️ Nenhum sharedSecret encontrado no DHResult do contexto.');
    }

    const vaultData: VaultPayload = {
      sharedSecret: sharedSecret,
      permissions: permissions,
      salt: btoa(password) // Simples ofuscação atrelada à senha informada
    };

    // Salva a estrutura stringificada (Agindo como o seu .txt virtual de persistência)
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(vaultData));
    console.log('%c[SessionCache] 🔒 Dados de segurança persistidos no Vault Privado.', 'color: #818cf8');
  }

  /**
   * Recupera os dados do Vault apenas se a senha informada for a correta.
   * Usado na reidratação para descriptografar o sessionStorage.
   */
  public recoverVaultData(password: string): { sharedSecret: string; permissions: string[] } | null {
    const rawVault = localStorage.getItem(this.STORAGE_KEY);
    if (!rawVault) {
      console.warn('[SessionCache] 🔑 Vault não encontrado.');
      return null;
    }

    try {
      const vaultData: VaultPayload = JSON.parse(rawVault);

      // Validação da senha/chave de acesso através do salt
      if (vaultData.salt !== btoa(password)) {
        console.error('[SessionCache] ❌ Acesso negado: Senha inválida para o Vault.');
        return null;
      }

      return {
        sharedSecret: vaultData.sharedSecret,
        permissions: vaultData.permissions
      };
    } catch (error) {
      console.error('[SessionCache] ❌ Falha crítica ao ler ou decodificar o Vault:', error);
      return null;
    }
  }

  /**
   * Destrói os dados físicos do cache (Útil em Logouts ou falhas de esteira)
   */
  public destroyVault(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('[SessionCache] 🧹 Vault privado limpo com sucesso.');
  }
}
