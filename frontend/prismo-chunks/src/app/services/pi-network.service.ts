import { Injectable } from '@angular/core';
import {
  PiSdkBase,
  PiPaymentData,
  PiPaymentCallbacks,
  PiPaymentContract,
  PiUser,
  PiNetworkPassphrase
} from '../../base/PiSDK.base';

export type { PiPaymentData, PiPaymentCallbacks, PiPaymentContract, PiUser };

/**
 * PiNetworkService — serviço Angular que encapsula o PiSdkBase.
 *
 * Responsabilidades:
 *  - Inicializar e gerenciar o ciclo de vida do Pi SDK
 *  - Expor métodos tipados para autenticação e pagamentos
 *  - Tratar pagamentos incompletos (transações Stellar pendentes de sessões anteriores)
 *  - Ser injetado como singleton em toda a aplicação
 */
@Injectable({ providedIn: 'root' })
export class PiNetworkService {

  private _initialized = false;
  private _incompletePayments: PiPaymentContract[] = [];

  // ── Estado público ─────────────────────────────────────────────────
  get isReady(): boolean {
    return !!(window.__piSdkReady && typeof window.Pi?.createPayment === 'function');
  }

  get isInitialized(): boolean {
    return this._initialized;
  }

  get currentUser(): PiUser | null {
    return PiSdkBase.user;
  }

  get accessToken(): string | null {
    return PiSdkBase.accessToken;
  }

  get networkPassphrase(): PiNetworkPassphrase {
    const env = (window as any).__prismoEnv ?? {};
    return env.production
      ? PiNetworkPassphrase.MAINNET
      : PiNetworkPassphrase.TESTNET;
  }

  get pendingPayments(): PiPaymentContract[] {
    return [...this._incompletePayments];
  }

  // ── Inicialização ──────────────────────────────────────────────────

  /**
   * Inicializa o Pi SDK. Seguro para chamar múltiplas vezes.
   * Deve ser chamado no bootstrap da aplicação ou no AppComponent.
   */
  init(): void {
    if (this._initialized) return;
    try {
      PiSdkBase.init();
      this._initialized = true;
      console.log(`[PiNetworkService] Pronto · ${this.networkPassphrase}`);
    } catch (err) {
      console.warn('[PiNetworkService] Pi SDK não disponível (fora do Pi Browser):', err);
    }
  }

  // ── Autenticação ───────────────────────────────────────────────────

  /**
   * Autentica o usuário via Pi OAuth 2.0.
   * Detecta e enfileira pagamentos incompletos da rede Stellar.
   */
  async connect(): Promise<PiUser | null> {
    if (!this.isReady) {
      console.warn('[PiNetworkService] Pi SDK não disponível.');
      return null;
    }

    try {
      const sdk = new PiSdkBase();
      await sdk.connect();

      this._incompletePayments = [];
      return PiSdkBase.user;
    } catch (err) {
      console.error('[PiNetworkService] Erro na autenticação Pi:', err);
      return null;
    }
  }

  // ── Pagamentos ─────────────────────────────────────────────────────

  /**
   * Cria um pagamento Pi através do contrato Stellar.
   *
   * Ciclo de vida:
   *  1. onReadyForServerApproval  → backend aprova o paymentId
   *  2. onReadyForServerCompletion → backend completa com o txid Stellar
   *  3. onCancel / onError → tratamento de falha
   */
  createPayment(
    data:      Pick<PiPaymentData, 'amount' | 'memo'> & { uid?: string },
    callbacks: PiPaymentCallbacks
  ): void {
    if (!this.isReady) {
      callbacks.onError(new Error('Pi SDK não inicializado. Abra no Pi Browser.'));
      return;
    }

    const paymentData: PiPaymentData = {
      amount: data.amount,
      memo:   data.memo,
      metadata: {
        plan:        'premium_monthly',
        uid:         data.uid ?? PiSdkBase.user?.uid ?? 'unknown',
        prismo_ver:  '1.0',
        network:     this.networkPassphrase,
        timestamp:   new Date().toISOString()
      }
    };

    PiSdkBase.createPayment(paymentData, callbacks);
  }

  // ── Pagamentos Incompletos (Stellar) ───────────────────────────────

  /**
   * Registra um pagamento incompleto detectado durante a autenticação.
   * Transações Stellar ficam pendentes quando o usuário fecha o app
   * antes da conclusão do ciclo approve → complete.
   */
  registerIncompletePayment(payment: PiPaymentContract): void {
    const alreadyTracked = this._incompletePayments.some(
      p => p.identifier === payment.identifier
    );
    if (!alreadyTracked) {
      this._incompletePayments.push(payment);
      console.warn(
        `[PiNetworkService] Pagamento incompleto registrado | id: ${payment.identifier} | amount: ${payment.amount} π`
      );
    }
  }

  /**
   * Tenta resolver um pagamento incompleto via backend.
   * O backend deve verificar o status na Pi Platform API e na rede Stellar.
   */
  async resolveIncompletePayment(
    paymentId: string,
    callbacks: Pick<PiPaymentCallbacks, 'onReadyForServerCompletion' | 'onCancel' | 'onError'>
  ): Promise<void> {
    const client = PiSdkBase.getHttpClient();
    if (!client) {
      callbacks.onError(new Error('HTTP client Pi não disponível'));
      return;
    }

    try {
      const response = await client.get(`/v2/payments/${paymentId}`);
      const payment = response?.data as PiPaymentContract;

      if (!payment) {
        callbacks.onError(new Error(`Pagamento ${paymentId} não encontrado`));
        return;
      }

      if (payment.status.developer_approved && !payment.status.developer_completed) {
        const txid = payment.transaction?.txid ?? '';
        if (txid) {
          await callbacks.onReadyForServerCompletion(paymentId, txid);
          this._incompletePayments = this._incompletePayments.filter(
            p => p.identifier !== paymentId
          );
        }
      } else if (payment.status.cancelled || payment.status.user_cancelled) {
        callbacks.onCancel(paymentId);
        this._incompletePayments = this._incompletePayments.filter(
          p => p.identifier !== paymentId
        );
      }
    } catch (err: any) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
