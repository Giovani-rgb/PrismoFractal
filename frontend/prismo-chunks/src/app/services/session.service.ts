import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EncryptedPayload } from '../models/session.model';

@Injectable({ providedIn: 'root' })
export class SessionService {
  public sharedSecret: string | null = null;
  private readonly API_BASE    = `${environment.apiUrl}/api/sessions`;
  private readonly STORAGE_KEY = environment.nameSessionKey;

  constructor(private http: HttpClient) {}

  /**
   * PIPELINE PÚBLICO UNIFICADO (Handshake DH ou Reidratação AES)
   * * Como o endpoint é o mesmo, repassamos o payload dinâmico enviado pelo Orquestrador.
   * Os headers de segurança e o freezerToken são injetados automaticamente via Interceptor.
   */
  executePublicAssignment(payload: any): Observable<any> {
    return this.http.post<any>(`${this.API_BASE}/public`, payload);
  }

  /**
   * CREATE — POST /anonymous
   */
  fetchNewSession(): Observable<EncryptedPayload> {
    return this.http.post<EncryptedPayload>(`${this.API_BASE}/anonymous`, {});
  }

  /**
   * REFRESH (legado) — POST /refresh
   */
  refreshSessionCookies(): Observable<EncryptedPayload> {
    return this.http.post<EncryptedPayload>(`${this.API_BASE}/refresh`, {}, {
      withCredentials: true,
    });
  }

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
}
