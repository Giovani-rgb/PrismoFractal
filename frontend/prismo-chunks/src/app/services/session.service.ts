import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { tap, catchError, switchMap, map } from 'rxjs/operators';
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
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly STORAGE_KEY = environment.jwtTokenKey;
  private readonly API = `${environment.apiUrl}/api/sessions/anonymous`;
  private readonly SECRET = environment.appSessionSecret;

  constructor(private http: HttpClient) {}

  /**
   * Solicita a sessão e descriptografa o payload AES-GCM
   */
  create(): Observable<Session> {
    console.log('[SessionService] 🚀 Solicitando sessão criptografada...');

    // 1. Fazemos o POST (o Interceptor já injeta os headers de ID e Secret)
    return this.http.post<{ ciphertext: string; iv: string }>(this.API, {}).pipe(
      // 2. Transformamos a Promise de descriptografia em um Observable
      switchMap(encryptedResponse => from(this.decryptData(encryptedResponse))),
      tap(session => {
        console.log('[SessionService] ✅ Sessão descriptografada:', session);
        this.save(session);
      }),
      catchError(error => {
        console.error('[SessionService] ❌ Erro no fluxo de sessão:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Lógica de descriptografia AES-GCM
   */
  private async decryptData(data: { ciphertext: string; iv: string }): Promise<Session> {
    try {
      // Converte o segredo de texto para bytes
      const encoder = new TextEncoder();
      const keyData = encoder.encode(this.SECRET);
      
      // Importa a chave para o formato SubtleCrypto
      const cryptoKey = await crypto.subtle.importKey(
        'raw', 
        keyData, 
        { name: 'AES-GCM' }, 
        false, 
        ['decrypt']
      );

      // Converte ciphertext e iv de Base64 para Uint8Array
      const iv = Uint8Array.from(atob(data.iv), c => c.charCodeAt(0));
      const ciphertext = Uint8Array.from(atob(data.ciphertext), c => c.charCodeAt(0));

      // Decodifica
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        cryptoKey,
        ciphertext
      );

      const decryptedText = new TextDecoder().decode(decryptedBuffer);
      return JSON.parse(decryptedText) as Session;
    } catch (err) {
      console.error('[SessionService] Falha na descriptografia:', err);
      throw new Error('Falha ao processar dados seguros do servidor.');
    }
  }

  readLocal(): Session | null {
    const raw = sessionStorage.getItem(this.STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private save(session: Session): void {
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
  }
}
