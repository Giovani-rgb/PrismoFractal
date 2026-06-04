import { Injectable, inject } from '@angular/core';
import { SessionContext } from '../context/session.context';
import { SessionPermition, DHResult } from '../models/session.model';

interface VaultPayload {
  dhResult: DHResult; // Guardamos o contrato matemático inteiro (B, sharedSecret, _b)
  permition: SessionPermition | null;
  salt: string;
}

@Injectable({ providedIn: 'root' })
export class SessionCacheService {
  private context = inject(SessionContext);
  private readonly STORAGE_KEY = '_prismo_secure_vault';

  /**
   * Persiste o DHResult completo + as permissions no vault local com ofuscação leve.
   */
  public saveCurrentContextToVault(password: string): void {
    const state = this.context.currentState;

    if (!state?.data) {
      throw new Error('[SessionCache] Não há dados ativos no contexto para persistir.');
    }

    // 1. Coleta o DHResult que agora reside na posição 1 da tupla metadata
    const dhResult = state.metadata ? state.metadata[1] : null;
    
    if (!dhResult || !dhResult.sharedSecret) {
      throw new Error('[SessionCache] ❌ Contrato DHResult ou sharedSecret ausentes no metadata do contexto para custódia.');
    }

    // Como validamos acima, o TypeScript agora sabe que dhResult e dhResult.sharedSecret NÃO são undefined
    const permition = state.data.permition ?? null;

    const vaultData: VaultPayload = {
      dhResult, // Passa o objeto validado
      permition,
      salt: btoa(password),
    };

    // 2. Aplica a cifra leve de embaralhamento antes de jogar no localStorage
    const serialized = JSON.stringify(vaultData);
    const obfuscated = this.obfuscate(serialized, password);

    localStorage.setItem(this.STORAGE_KEY, obfuscated);
    console.log('%c[SessionCache] 🔒 Vault criptografado e persistido com DHResult completo vindo de metadata.',
      'color: #818cf8; font-weight: bold;');
  }

  /**
   * Recupera os dados do vault, desembaralha e devolve as chaves estruturadas.
   */
  public recoverVaultData(password: string): {
    dhResult: DHResult;
    sharedSecret: string; // Exige uma string estrita
    permissions: SessionPermition | null;
  } | null {
    const rawVault = localStorage.getItem(this.STORAGE_KEY);
    if (!rawVault) {
      console.warn('[SessionCache] 🔑 Vault não encontrado.');
      return null;
    }

    try {
      // 1. Desembaralha a string vinda do localStorage usando a senha
      const deobfuscated = this.deobfuscate(rawVault, password);
      const vaultData: VaultPayload = JSON.parse(deobfuscated);

      if (vaultData.salt !== btoa(password)) {
        console.error('[SessionCache] ❌ Senha inválida para abrir o Vault.');
        return null;
      }

      // Validação de segurança para acalmar o compilador TypeScript:
      // Garante que o segredo realmente existe no objeto recuperado antes de prosseguir
      if (!vaultData.dhResult || !vaultData.dhResult.sharedSecret) {
        console.error('[SessionCache] ❌ Integridade violada: sharedSecret ausente dentro do Vault reconstruído.');
        return null;
      }

      // 2. Retorna o DHResult completo e injeta o sharedSecret garantido
      return {
        dhResult:     vaultData.dhResult,
        sharedSecret: vaultData.dhResult.sharedSecret, // O TypeScript agora sabe que 100% não é undefined
        permissions:  vaultData.permition,
      };
    } catch (error) {
      console.error('[SessionCache] ❌ Falha ao ler ou decifrar o Vault (Dados corrompidos ou senha errada):', error);
      return null;
    }
  }

  public destroyVault(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('[SessionCache] 🧹 Vault limpo com sucesso.');
  }

  // ─── Métodos de Ofuscação / Embaralhar (Cifra XOR Dinâmica + Base64) ─────────

  /**
   * Embaralha uma string aplicando operação XOR caractere por caractere baseada na senha,
   * convertendo o resultado final para Base64 seguro.
   */
  private obfuscate(text: string, key: string): string {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      // Faz o XOR combinando o caractere atual com o caractere correspondente da senha
      const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    return btoa(unescape(encodeURIComponent(result))); // Converte em Base64 estável (suporta acentos)
  }

  /**
   * Reverte o processo de ofuscação aplicando a mesma operação XOR.
   */
  private deobfuscate(encodedText: string, key: string): string {
    const decoded = decodeURIComponent(escape(atob(encodedText))); // Reverte o Base64
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  }
}
