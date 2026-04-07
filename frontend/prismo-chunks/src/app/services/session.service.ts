import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EncryptedPayload } from '../models/session.model';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly API = `${environment.apiUrl}/api/sessions/anonymous`;
  private readonly STORAGE_KEY = environment.nameSessionKey;

  constructor(private http: HttpClient) {}

  /**
   * MÓDULO DE INGESTÃO (POST)
   * Cria uma nova sessão enviando um body vazio.
   */
  fetchNewSession(): Observable<EncryptedPayload> {
    return this.http.post<EncryptedPayload>(this.API, {});
  }

  /**
   * MÓDULO DE BATIDA (GET)
   * Renova o ciclo de vida da sessão e os cookies no backend.
   * Não envia body; a identificação é feita via Cookies.
   */
  refreshSessionCookies(): Observable<void> {
    return this.http.get<void>(`${this.API}/refresh`, {
      withCredentials: true // Permite o tráfego de cookies de sessão
    });
  }

  /**
   * PERSISTÊNCIA NO STORAGE
   * Lida com o Storage "cru" serializando o EncryptedPayload.
   */
  saveToStorage(payload: EncryptedPayload): void {
    if (payload) {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
    }
  }

  /**
   * RECUPERAÇÃO DO STORAGE
   */
  getFromStorage(): EncryptedPayload | null {
    const data = sessionStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  }

  /**
   * PURGE
   */
  clearStorage(): void {
    sessionStorage.removeItem(this.STORAGE_KEY);
  }
}
