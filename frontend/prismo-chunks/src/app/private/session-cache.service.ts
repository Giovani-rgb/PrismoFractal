import { Injectable, inject } from '@angular/core';
import { SessionContext } from '../context/session.context';
import { SessionPermition } from '../models/session.model';

interface VaultPayload {
  sharedSecret: string;
  permissions: SessionPermition | null;
  salt: string;
  sessionToken?: string;
}

@Injectable({ providedIn: 'root' })
export class SessionCacheService {
  private context = inject(SessionContext);
  private readonly STORAGE_KEY = '_prismo_secure_vault';

  public saveCurrentContextToVault(password: string): void {
    const state = this.context.currentState;

    if (!state || !state.data) {
      throw new Error('[SessionCache] Não há dados ativos no contexto para persistir.');
    }

    const maybeSecret = state.dhResult?.sharedSecret;
    if (!maybeSecret) {
      throw new Error('[SessionCache] ❌ Falha crítica: sharedSecret não encontrado no dhResult do contexto.');
    }

    const sharedSecret: string = maybeSecret;
    const permissions = state.data.permition ?? null;
    const sessionToken = state.data.token;

    const vaultData: VaultPayload = {
      sharedSecret,
      permissions,
      salt: btoa(password),
      ...(sessionToken ? { sessionToken } : {}),
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(vaultData));
    console.log('%c[SessionCache] 🔒 Vault persistido com sharedSecret + sessionToken.', 'color: #818cf8');
  }

  public recoverVaultData(password: string): {
    sharedSecret: string;
    permissions: SessionPermition | null;
    sessionToken?: string;
  } | null {
    const rawVault = localStorage.getItem(this.STORAGE_KEY);
    if (!rawVault) {
      console.warn('[SessionCache] 🔑 Vault não encontrado.');
      return null;
    }

    try {
      const vaultData: VaultPayload = JSON.parse(rawVault);

      if (vaultData.salt !== btoa(password)) {
        console.error('[SessionCache] ❌ Acesso negado: Senha inválida para o Vault.');
        return null;
      }

      return {
        sharedSecret: vaultData.sharedSecret,
        permissions:  vaultData.permissions,
        sessionToken: vaultData.sessionToken,
      };
    } catch (error) {
      console.error('[SessionCache] ❌ Falha crítica ao ler o Vault:', error);
      return null;
    }
  }

  public destroyVault(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('[SessionCache] 🧹 Vault privado limpo com sucesso.');
  }
}
