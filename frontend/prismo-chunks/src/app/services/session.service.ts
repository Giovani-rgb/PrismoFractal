import { Injectable, signal } from '@angular/core';

export interface Session {
  id: string;
  projectName: string;
  createdAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private sessionSignal = signal<Session | null>(this.loadSession());

  session = this.sessionSignal.asReadonly();

  constructor() {
    this.initializeSession();
  }

  private loadSession(): Session | null {
    if (typeof localStorage === 'undefined') return null;
    const stored = localStorage.getItem('prismo_session');
    return stored ? JSON.parse(stored) : null;
  }

  initializeSession(): void {
    const existing = this.sessionSignal();
    if (!existing) {
      const session: Session = {
        id: this.generateSessionId(),
        projectName: 'Meu Projeto',
        createdAt: Date.now()
      };
      this.setSession(session);
    }
  }

  setSession(session: Session): void {
    localStorage.setItem('prismo_session', JSON.stringify(session));
    this.sessionSignal.set(session);
  }

  clearSession(): void {
    localStorage.removeItem('prismo_session');
    this.sessionSignal.set(null);
  }

  isActive(): boolean {
    return this.sessionSignal() !== null;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
