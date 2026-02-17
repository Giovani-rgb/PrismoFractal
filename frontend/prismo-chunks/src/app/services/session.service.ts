import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, switchMap, tap } from 'rxjs';

export interface Session {
  id: string;
  status: 'ACTIVE' | 'CLOSED' | 'EXPIRED';
  createdAt: number;
}

@Injectable({ providedIn: 'root' })
export class SessionService {

  private readonly STORAGE_KEY = 'prismo_session';
  private readonly API = '/api/sessions';

  constructor(private http: HttpClient) {}

  // 1️⃣ Lê a sessão
  read(): Observable<Session | null> {
    console.log('[SessionService] 🔍 read() iniciado');

    const stored = this.loadFromSessionStorage();

    if (stored) {
      console.log('[SessionService] 📦 sessão encontrada no sessionStorage', stored);
      return of(stored);
    }

    console.log('[SessionService] ❌ nenhuma sessão no sessionStorage');

    const cookieSessionId = this.readCookie('SESSION_ID');

    if (!cookieSessionId) {
      console.log('[SessionService] 🍪 cookie SESSION_ID não encontrado');
      return of(null);
    }

    console.log('[SessionService] 🍪 cookie encontrado:', cookieSessionId);
    console.log('[SessionService] 🌐 consultando backend /read');

    return this.http.post<Session>(
      `${this.API}/read`,
      { sessionId: cookieSessionId }
    ).pipe(
      tap(session => {
        console.log('[SessionService] ✅ sessão lida do backend', session);
        this.save(session);
      })
    );
  }

  // 2️⃣ Cria sessão
  create(): Observable<Session> {
    console.log('[SessionService] 🆕 create() chamado');
    console.log('[SessionService] 🌐 criando sessão no backend');

    return this.http.post<Session>(this.API, {}).pipe(
      tap(session => {
        console.log('[SessionService] ✅ sessão criada', session);
        this.save(session);
      })
    );
  }

  // 3️⃣ Read or Create
  getOrCreate(): Observable<Session> {
    console.log('[SessionService] 🔁 getOrCreate() iniciado');

    return this.read().pipe(
      switchMap(session => {
        if (session) {
          console.log('[SessionService] 👍 usando sessão existente', session);
          return of(session);
        }

        console.log('[SessionService] 🚨 nenhuma sessão válida, criando nova');
        return this.create();
      })
    );
  }

  // -----------------------
  // helpers
  // -----------------------

  private loadFromSessionStorage(): Session | null {
    const raw = sessionStorage.getItem(this.STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  private save(session: Session): void {
    console.log('[SessionService] 💾 salvando sessão no sessionStorage');
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
  }

  private readCookie(name: string): string | null {
    const match = document.cookie
      .split('; ')
      .find(row => row.startsWith(name + '='));
    return match ? match.split('=')[1] : null;
  }
}
