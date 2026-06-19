import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { OAuthTag, PrismoOAuthState, OAuthData, OAuthPermition } from '../models/oauth.model';

@Injectable({ providedIn: 'root' })
export class OauthContext {

  private readonly _state = new BehaviorSubject<PrismoOAuthState>({
    data: null,
    permition: null,
    tag: OAuthTag.VOID,
    metadata: {
      0: { timestamp: Date.now(), step: 'INITIALIZATION' }
    }
  });

  public readonly state$ = this._state.asObservable();

  constructor() {
    window.addEventListener('online', () => this.updateNetworkStatus(true));
    window.addEventListener('offline', () => this.updateNetworkStatus(false));
  }

  /**
   * ESTEIRA: Define a Rota de Operação (OAUTH, REFRESH, UPDATE, DELETE)
   */
  setOperation(tag: OAuthTag): void {
    const current = this._state.getValue();

    // Rastreia o histórico de transições dentro do dicionário de metadados
    const currentMetadata = current.metadata || {};
    const nextIndex = Object.keys(currentMetadata).length;

    this._state.next({
      ...current,
      tag: tag, // Rota ou subestado ativo na esteira
      metadata: {
        ...currentMetadata,
        [nextIndex]: { timestamp: Date.now(), step: `SET_OPERATION_${tag}` }
      }
    });
  }

  /**
   * ESTEIRA: Finalização (Sela o estado com os dados providos pelo terceiro)
   */
  setOAuthData(oauthData: OAuthData, initialPermition: OAuthPermition | null = null): void {
    const current = this._state.getValue();
    const currentMetadata = current.metadata || {};
    const nextIndex = Object.keys(currentMetadata).length;

    this._state.next({
      ...current,
      data: oauthData,
      permition: initialPermition,
      tag: OAuthTag.REST, // Selo de estabilidade do ecossistema
      metadata: {
        ...currentMetadata,
        [nextIndex]: { timestamp: Date.now(), step: 'OAUTH_DATA_CONSOLIDATED' }
      }
    });
  }

  /**
   * SEGURANÇA: Atualiza cirurgicamente apenas os escopos e travas de assinatura
   * sem violar as propriedades de identificação do usuário mapeado.
   */
  updatePermitions(permition: Partial<OAuthPermition>): void {
    const current = this._state.getValue();
    if (!current.permition) return;

    this._state.next({
      ...current,
      permition: {
        ...current.permition,
        ...permition // Mescla novos escopos de tráfego ou expiração
      }
    });
  }

  /**
   * SENSOR: Gerencia Conectividade aplicando a tag OFFLINE
   */
  private updateNetworkStatus(online: boolean): void {
    const current = this._state.getValue();
    this._state.next({
      ...current,
      // Se a rede cair, assume a tag mandatória de isolamento. 
      // Se voltar, recupera a estabilidade (REST) caso já possua dados instanciados, caso contrário retorna a VOID.
      tag: online ? (current.data ? OAuthTag.REST : OAuthTag.VOID) : OAuthTag.OFFLINE
    });
  }

  /**
   * Limpa completamente o estado do OAuth e reinicializa os logs de passos
   */
  clear(): void {
    this._state.next({
      data: null,
      permition: null,
      tag: OAuthTag.VOID,
      metadata: {
        0: { timestamp: Date.now(), step: 'PURGE_CLEAN' }
      }
    });
  }

  /**
   * GETTERS: Atalhos de leitura direta síncrona
   */
  get currentState(): PrismoOAuthState { 
    return this._state.getValue(); 
  }

  get currentPermitions(): OAuthPermition | null {
    return this._state.getValue().permition;
  }
}
