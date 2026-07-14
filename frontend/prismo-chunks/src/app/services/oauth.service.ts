import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment'; 

@Injectable({ providedIn: 'root' })
export class OAuthService {
  private http = inject(HttpClient);

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

  /**
   * ROTA 3 (SDK - GET): Retorna uma Promise para o contrato do SDK,
   * mas passa pelo HttpClient para o Interceptor/Gatekeeper capturar.
   */
  getSdkProfile(): Promise<any> {
    return firstValueFrom(
      this.http.get<any>('https://socialchain.app/v2/me')
    );
  }

  /**
   * ROTA 4 (SDK - POST): Rota externa observada pelo Interceptor/Gatekeeper
   */
  trackSdkEvent(trackPayload: any): Observable<any> {
    return this.http.post<any>('https://socialchain.app/v2/usage/track', trackPayload);
  }
}
