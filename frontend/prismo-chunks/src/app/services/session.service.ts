import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError } from 'rxjs';
import { throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Session {
  status: string;
  createdAt: number;
  expiresAt?: number;
}

@Injectable({ providedIn: 'root' })
export class SessionService {

  private readonly STORAGE_KEY = environment.jwtTokenKey;
  private readonly API = `${environment.apiUrl}/api/sessions/anonymous`;

  constructor(private http: HttpClient) {}

  /**
   * Cria sessão no backend.
   * Backend decide token, cookie, etc.
   */
  create(): Observable<Session> {

    console.log('[SessionService] 🚀 Chamando API para criar sessão...');

    return this.http.post<Session>(this.API, {}).pipe(

      tap(session => {
        console.log('[SessionService] ✅ Sessão recebida do backend:', session);
        this.save(session);
      }),

      catchError(error => {
        console.error('[SessionService] ❌ Erro ao criar sessão:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Recupera sessão do sessionStorage (somente cache local)
   */
  readLocal(): Session | null {

    console.log('[SessionService] 🔎 Lendo sessão do sessionStorage...');

    const raw = sessionStorage.getItem(this.STORAGE_KEY);

    if (!raw) {
      console.warn('[SessionService] ⚠️ Nenhuma sessão encontrada no storage.');
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      console.log('[SessionService] 📦 Sessão encontrada no storage:', parsed);
      return parsed;
    } catch (e) {
      console.error('[SessionService] ❌ Erro ao fazer parse da sessão:', e);
      return null;
    }
  }

  /**
   * Salva sessão no sessionStorage
   */
  private save(session: Session): void {

    console.log('[SessionService] 💾 Salvando sessão no sessionStorage...');

    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));

    console.log('[SessionService] ✅ Sessão salva com sucesso.');
  }
}