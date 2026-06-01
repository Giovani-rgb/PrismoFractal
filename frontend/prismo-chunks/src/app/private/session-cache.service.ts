import { Injectable, inject } from '@angular/core';
import { SessionContext } from '../context/session.context';
import { SessionPermition } from '../models/session.model';

interface VaultPayload {
  sharedSecret: string;
  permissions: SessionPermition | null;
  salt: string;
}

@Injectable({ providedIn: 'root' })
export class SessionCacheService {
  private context = inject(SessionContext);
  private readonly STORAGE_KEY = '_prismo_secure_vault';

  /**
   * Persiste sharedSecret + permissions no vault local.
   * As permissions contêm navigation.freezerToken — chave de reidratação futura.
   */
  public saveCurrentContextToVault(password: string): void {
    const state = this.context.currentState;

    if (!state?.data) {
      throw new Error('[SessionCache] Não há dados ativos no contexto para persistir.');
    }

    const maybeSecret = state.dhResult?.sharedSecret;
    if (!maybeSecret) {
      throw new Error('[SessionCache] ❌ sharedSecret ausente no dhResult do contexto.');
    }

    const sharedSecret: string = maybeSecret;
    const permissions = state.data.permition ?? null;

    const vaultData: VaultPayload = {
      sharedSecret,
      permissions,
      salt: btoa(password),
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(vaultData));
    console.log('%c[SessionCache] 🔒 Vault persistido. freezerToken em permissions.navigation.',
      'color: #818cf8');
  }

  /**
   * Recupera dados do vault.
   * O freezeToken de reidratação está em permissions.navigation.freezerToken.
   */
  public recoverVaultData(password: string): {
    sharedSecret: string;
    permissions: SessionPermition | null;
  } | null {
    const rawVault = localStorage.getItem(this.STORAGE_KEY);
    if (!rawVault) {
      console.warn('[SessionCache] 🔑 Vault não encontrado.');
      return null;
    }

    try {
      const vaultData: VaultPayload = JSON.parse(rawVault);

      if (vaultData.salt !== btoa(password)) {
        console.error('[SessionCache] ❌ Senha inválida para o Vault.');
        return null;
      }

      return {
        sharedSecret: vaultData.sharedSecret,
        permissions:  vaultData.permissions,
      };
    } catch (error) {
      console.error('[SessionCache] ❌ Falha ao ler o Vault:', error);
      return null;
    }
  }

  public destroyVault(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('[SessionCache] 🧹 Vault limpo.');
  }
}
