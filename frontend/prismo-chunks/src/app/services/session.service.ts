import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EncryptedPayload } from '../models/session.model';

@Injectable({ providedIn: 'root' })
export class SessionService {
  public sharedSecret: string | null = null; 
  private readonly API_BASE = `${environment.apiUrl}/api/sessions`;
  private readonly STORAGE_KEY = environment.nameSessionKey;

  constructor(private http: HttpClient) {}

  /**
   * ESTÁGIO 1 & 2: HANDSHAKE DIFFIE-HELLMAN
   * O Interceptor agora cuida do X-Window-Token automaticamente.
   * O serviço envia apenas o payload 'B' se ele existir.
   */
  publicHandshake(clientB?: string): Observable<any> {
      const body: any = {};
      if (clientB) body.B = clientB;
      return this.http.post<any>(`${this.API_BASE}/public`, body);
  }


  /**
   * MÓDULO DE INGESTÃO (POST)
   */
  fetchNewSession(): Observable<EncryptedPayload> {
    return this.http.post<EncryptedPayload>(`${this.API_BASE}/anonymous`, {});
  }

  /**
   * MÓDULO DE REFRESH (POST)
   */
  refreshSessionCookies(): Observable<EncryptedPayload> {
    return this.http.post<EncryptedPayload>(`${this.API_BASE}/refresh`, {}, {
      withCredentials: true 
    });
  }

  /**
   * PERSISTÊNCIA E STORAGE
   */
  saveToStorage(payload: EncryptedPayload): void {
    if (payload) {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
    }
  }

  getFromStorage(): EncryptedPayload | null {
    const data = sessionStorage.getItem(this.STORAGE_KEY);
    try {
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  clearStorage(): void {
    sessionStorage.removeItem(this.STORAGE_KEY);
    // Limpa também o token de memória do interceptor
    (window as any)._sessionToken = null;
  }
}
