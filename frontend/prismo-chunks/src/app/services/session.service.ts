import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Session {
  id_prospect: string;
  refs: any;
  country: string;
  revoked: boolean;
  keyUpdate: string;
  createdAt: number;
  expiresAt: number;
  lastAccessAt: number;
  token?: string;
}

interface EncryptedPayload {
  ciphertext: string;
  iv: string;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly STORAGE_KEY = environment.jwtTokenKey;
  private readonly API = `${environment.apiUrl}/api/sessions/anonymous`;
  private readonly SECRET = environment.appSessionSecret;

  constructor(private http: HttpClient) {}

  /**
   * Solicita a nova sessão ao servidor e salva o payload CRIPTOGRAFADO no storage.
   */
  create(): Observable<EncryptedPayload> {
    console.log('[SessionService] 🚀 Solicitando nova sessão (armazenamento seguro)...');

    return this.http.post<EncryptedPayload>(this.API, {}).pipe(
      tap(payload => {
        if (!payload.iv || !payload.ciphertext) {
          throw new Error('Resposta do servidor com payload de segurança incompleto.');
        }
        this.persistEncryptedPayload(payload);
        console.log('[SessionService] ✅ Payload criptografado persistido no sessionStorage.');
      }),
      catchError(error => {
        console.error('[SessionService] ❌ Falha na criação da sessão:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Recupera o payload do sessionStorage e realiza a descriptografia "on-the-fly".
   * Nome explícito conforme solicitado: busca apenas do storage local.
   */
  async readSessionFromLocal(): Promise<Session | null> {
    const rawData = sessionStorage.getItem(this.STORAGE_KEY);
    
    if (!rawData) {
      console.warn('[SessionService] Nenhuma sessão encontrada no armazenamento local.');
      return null;
    }

    try {
      const payload: EncryptedPayload = JSON.parse(rawData);
      
      // Validação básica do objeto recuperado
      if (!payload.iv || !payload.ciphertext) {
        throw new Error('Dados no storage estão corrompidos ou em formato inválido.');
      }

      const session = await this.decryptData(payload);
      console.log('[SessionService] 🔓 Sessão local descriptografada com sucesso.');
      return session;

    } catch (err) {
      console.error('[SessionService] Erro ao processar sessão local:', err);
      // Opcional: Limpar o storage caso o dado esteja corrompido
      // this.clearLocal();
      return null;
    }
  }

  /**
   * Lógica interna de descriptografia usando AES-GCM
   */
  private async decryptData(data: EncryptedPayload): Promise<Session> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.SECRET);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw', 
      keyData, 
      { name: 'AES-GCM' }, 
      false, 
      ['decrypt']
    );

    // Decodifica Base64 para buffer
    const iv = Uint8Array.from(atob(data.iv), c => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(data.ciphertext), c => c.charCodeAt(0));

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      ciphertext
    );

    const decryptedText = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decryptedText) as Session;
  }

  /**
   * Persiste o objeto criptografado como string no storage
   */
  private persistEncryptedPayload(payload: EncryptedPayload): void {
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
  }

  /**
   * Remove a sessão do armazenamento
   */
  clearLocal(): void {
    sessionStorage.removeItem(this.STORAGE_KEY);
  }
}
