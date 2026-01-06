
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
  read(): Observable<Session> {
    const stored = this.loadFromSessionStorage();

    if (stored) {
      return of(stored);
    }

    const cookieSessionId = this.readCookie('SESSION_ID');

    return this.http.post<Session>(
      `${this.API}/read`,
      { sessionId: cookieSessionId }
    ).pipe(
      tap(session => this.save(session))
    );
  }

  // 2️⃣ Cria sessão (POST sem body)
  create(): Observable<Session> {
    return this.http.post<Session>(this.API, {}).pipe(
      tap(session => this.save(session))
    );
  }

  // 3️⃣ Read-or-create (orquestração)
  getOrCreate(): Observable<Session> {
    return this.read().pipe(
      switchMap(session =>
        session ? of(session) : this.create()
      )
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
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
  }

  private readCookie(name: string): string | null {
    const match = document.cookie
      .split('; ')
      .find(row => row.startsWith(name + '='));
    return match ? match.split('=')[1] : null;
  }
}
