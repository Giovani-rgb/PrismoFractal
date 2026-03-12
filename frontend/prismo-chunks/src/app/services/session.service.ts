import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
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

/**
 * Interface para tipar a resposta criptografada do servidor
 */
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
   * Solicita a sessão ao servidor e gerencia o fluxo de descriptografia
   */
  create(): Observable<Session> {
    console.log('[SessionService] 🚀 Solicitando sessão segura...');

    // O Angular agora recebe um objeto JSON estruturado
    return this.http.post<EncryptedPayload>(this.API, {}).pipe(
      switchMap(payload => {
        // Validação básica para garantir que o payload chegou correto
        if (!payload.iv || !payload.ciphertext) {
          throw new Error('Payload de segurança incompleto vindo do servidor.');
        }
        // Converte a Promise da descriptografia em um Observable
        return from(this.decryptData(payload));
      }),
      tap(session => {
        console.log('[SessionService] ✅ Sessão descriptografada com sucesso');
        this.save(session);
      }),
      catchError(error => {
        // Captura erros de rede, de parse ou de descriptografia
        console.error('[SessionService] ❌ Erro no fluxo de sessão:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Implementação técnica da descriptografia AES-GCM usando Web Crypto API
   */
  private async decryptData(data: EncryptedPayload): Promise<Session> {
    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(this.SECRET);
      
      // Importa a chave (deve ter 16, 24 ou 32 bytes para AES)
      const cryptoKey = await crypto.subtle.importKey(
        'raw', 
        keyData, 
        { name: 'AES-GCM' }, 
        false, 
        ['decrypt']
      );

      // Decodifica as strings Base64 vindas do backend
      const iv = Uint8Array.from(atob(data.iv), c => c.charCodeAt(0));
      const ciphertext = Uint8Array.from(atob(data.ciphertext), c => c.charCodeAt(0));

      // Realiza a descriptografia
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        cryptoKey,
        ciphertext
      );

      // Converte o buffer resultante de volta para texto e depois para objeto Session
      const decryptedText = new TextDecoder().decode(decryptedBuffer);
      return JSON.parse(decryptedText) as Session;

    } catch (err) {
      console.error('[SessionService] Falha técnica na descriptografia:', err);
      // Erros aqui geralmente significam chave incorreta ou dados corrompidos
      throw new Error('Não foi possível descriptografar os dados da sessão.');
    }
  }

  /**
   * Persistência local da sessão
   */
  private save(session: Session): void {
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
  }

  /**
   * Recupera a sessão atual do armazenamento local
   */
  readLocal(): Session | null {
    const raw = sessionStorage.getItem(this.STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}