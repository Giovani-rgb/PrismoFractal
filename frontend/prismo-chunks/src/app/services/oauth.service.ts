import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment'; // Ajuste o caminho conforme seu projeto

@Injectable({ providedIn: 'root' })
export class OAuthService {
  private http = inject(HttpClient);
  
  // Centraliza o endpoint base (ex: 'api/oauth' ou a URL cheia do gateway)
  private readonly baseUrl = `${environment.apiUrl}/api/oauth`;

  /**
   * ROTA 1: /api/oauth/r (Tag: VOID)
   */
  requestOAuthAuthorization(payload: { iv: string; ciphertext: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/r`, payload);
  }

  /**
   * ROTA 2: /api/oauth/PiOAuth (Tag: OAUTH)
   */
  authenticateWithPiNetwork(piPayload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/PiOAuth`, piPayload);
  }
}
