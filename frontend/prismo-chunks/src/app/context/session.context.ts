import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Session, SessionTag, PrismoSessionState, DiffieHellmanModel, DHResult, SessionPermition } from '../models/session.model';

@Injectable({ providedIn: 'root' })
export class SessionContext {

  private readonly _state = new BehaviorSubject<PrismoSessionState>({
    data: null,
    tag: SessionTag.VOID, 
    is_ready: false,
    is_loading: false,
    is_online: navigator.onLine,
    schedule_requests: !navigator.onLine,
    use_pwa_styles: window.matchMedia('(display-mode: standalone)').matches,
    dhContext: null, // Metadados iniciais nulos
    dhResult: null   // Segredo simétrico inicial nulo
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
   * CRIPTO: Estaciona os parâmetros primordiais e a chave pública B no estado
   */
  setDHContext(context: DiffieHellmanModel): void {
    const current = this._state.getValue();
    this._state.next({
      ...current,
      dhContext: context
    });
  }

  /**
   * CRIPTO: Consolida o resultado do Handshake contendo a Shared Secret efêmera
   */
  setDHResult(result: DHResult): void {
    const current = this._state.getValue();
    this._state.next({
      ...current,
      dhResult: result
    });
  }

  /**
   * ESTEIRA: Finalização (Sempre define como REST para liberar APIs)
   * A entidade 'Session' injetada aqui já carrega a propriedade 'permition' opcional.
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
   * SEGURANÇA: Atualiza cirurgicamente apenas a gaveta de permissões/freezer
   * sem violar ou reescrever as propriedades de identificação da sessão.
   */
  updatePermitions(permition: SessionPermition): void {
    const current = this._state.getValue();
    if (!current.data) return;

    this._state.next({
      ...current,
      data: {
        ...current.data,
        permition: {
          ...current.data.permition,
          ...permition // Mescla os novos objetos rwu, navigation ou travas temporárias
        }
      }
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

  /**
   * Limpa completamente o estado da sessão e purga os metadados criptográficos
   */
  clear(): void {
    this._state.next({
      data: null,
      tag: SessionTag.VOID,
      is_ready: false,
      is_loading: false,
      is_online: navigator.onLine,
      schedule_requests: !navigator.onLine,
      use_pwa_styles: window.matchMedia('(display-mode: standalone)').matches,
      dhContext: null,
      dhResult: null
    });
  }

  get currentState(): PrismoSessionState { return this._state.getValue(); }

  /**
   * ATALHO: Expõe de forma limpa as permissões ativas para Route Guards e interceptors
   */
  get currentPermitions(): SessionPermition | null {
    return this._state.getValue().data?.permition || null;
  }
}



