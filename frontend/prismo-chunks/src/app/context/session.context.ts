import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Session, SessionTag, PrismoSessionState } from '../models/session.model';

@Injectable({ providedIn: 'root' })
export class SessionContext {

  private readonly _state = new BehaviorSubject<PrismoSessionState>({
    data: null,
    tag: SessionTag.VOID, 
    is_ready: false,
    is_loading: false,
    is_online: navigator.onLine,
    schedule_requests: !navigator.onLine,
    use_pwa_styles: window.matchMedia('(display-mode: standalone)').matches
  });

  public readonly state$ = this._state.asObservable();

  constructor() {
    window.addEventListener('online', () => this.updateNetworkStatus(true));
    window.addEventListener('offline', () => this.updateNetworkStatus(false));
  }

  /**
   * ESTEIRA: Define a Rota de Operação (CREATE, REHYDRATE, UPDATE)
   */
  setOperation(tag: SessionTag): void {
    const current = this._state.getValue();
    this._state.next({
      ...current,
      tag: tag, // Rota ativa
      is_loading: true,
      is_ready: false
    });
  }

  /**
   * ESTEIRA: Finalização (Sempre define como REST para liberar APIs)
   */
  setSession(session: Session): void {
    const current = this._state.getValue();
    this._state.next({
      ...current,
      data: session,
      tag: SessionTag.REST, // Selo de Estabilidade
      is_ready: true,
      is_loading: false
    });
  }

  /**
   * SENSOR: Gerencia Conectividade e a Tag OFFLINE
   */
  private updateNetworkStatus(online: boolean): void {
    const current = this._state.getValue();
    this._state.next({
      ...current,
      is_online: online,
      schedule_requests: !online,
      // Se cair a rede, vira OFFLINE. Se voltar, volta para REST (se houver dados) ou VOID.
      tag: online ? (current.data ? SessionTag.REST : SessionTag.VOID) : SessionTag.OFFLINE
    });
  }

  clear(): void {
    this._state.next({
      data: null,
      tag: SessionTag.VOID,
      is_ready: false,
      is_loading: false,
      is_online: navigator.onLine,
      schedule_requests: !navigator.onLine,
      use_pwa_styles: window.matchMedia('(display-mode: standalone)').matches
    });
  }

  get currentState(): PrismoSessionState { return this._state.getValue(); }
}

