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
   * DH HANDSHAKE — via interceptor global (tag-based).
   */
  publicHandshake(clientB?: string): Observable<any> {
    const body: any = {};
    if (clientB) body.B = clientB;
    return this.http.post<any>(`${this.API_BASE}/public`, body);
  }

  /**
   * REIDRATAÇÃO VIA FREEZE TOKEN — POST /public com corpo explícito.
   * O backend identifica o fluxo de reidratação pela presença de freezeToken + iv + ciphertext.
   * Usa headers explícitos (sem interceptor de sessão).
   */
  rehydrateWithFreezeToken(
    freezeToken: string,
    iv: string,
    ciphertext: string
  ): Observable<EncryptedPayload> {
    return this.http.post<EncryptedPayload>(
      `${this.API_BASE}/public`,
      { freezeToken, iv, ciphertext },
      {
        headers: {
          'X-App-Id':      environment.appId,
          'Authorization': `Bearer ${environment.appSessionSecret}`,
        },
      }
    );
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
