import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EncryptedPayload } from '../models/session.model';

@Injectable({ providedIn: 'root' })
export class SessionService {
  public sharedSecret: string | null = null;
  private readonly API_BASE  = `${environment.apiUrl}/api/sessions`;
  private readonly STORAGE_KEY = environment.nameSessionKey;

  constructor(private http: HttpClient) {}

  /**
   * DH HANDSHAKE — via global interceptor (tag-based).
   * Stage 1: no body, returns {p, g, A, windowToken, minWait}
   * Stage 2: body {B} + X-Window-Token header (injected by interceptor via window._sessionToken)
   */
  publicHandshake(clientB?: string): Observable<any> {
    const body: any = {};
    if (clientB) body.B = clientB;
    return this.http.post<any>(`${this.API_BASE}/public`, body);
  }

  /**
   * DH HANDSHAKE — direct call with explicit headers (for use inside Rehydrate stage, tag=VOID).
   * @param clientB  Client's public DH key (undefined = Phase 1)
   * @param windowToken  Anti-bot window token received from Phase 1 (only for Phase 2)
   */
  publicHandshakeDirect(clientB?: string, windowToken?: string): Observable<any> {
    const body: any = {};
    if (clientB) body.B = clientB;

    const headers: Record<string, string> = {
      'X-App-Id': environment.appId,
      'Authorization': `Bearer ${environment.appSessionSecret}`,
    };
    if (windowToken) headers['X-Window-Token'] = windowToken;

    return this.http.post<any>(`${this.API_BASE}/public`, body, { headers });
  }

  /**
   * CREATE — POST /anonymous
   */
  fetchNewSession(): Observable<EncryptedPayload> {
    return this.http.post<EncryptedPayload>(`${this.API_BASE}/anonymous`, {});
  }

  /**
   * REFRESH (legacy) — POST /refresh with interceptor headers
   */
  refreshSessionCookies(): Observable<EncryptedPayload> {
    return this.http.post<EncryptedPayload>(`${this.API_BASE}/refresh`, {}, {
      withCredentials: true,
    });
  }

  /**
   * REFRESH via Passport — POST /refresh with explicit JWT + passport token.
   * Backend decrypts with the DH sharedSecret tied to passportToken.
   */
  refreshWithPassportDirect(passportToken: string, jwt: string): Observable<EncryptedPayload> {
    return this.http.post<EncryptedPayload>(
      `${this.API_BASE}/refresh`,
      {},
      {
        withCredentials: true,
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'X-Passport-Token': passportToken,
          'X-App-Id': environment.appId,
        },
      }
    );
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
