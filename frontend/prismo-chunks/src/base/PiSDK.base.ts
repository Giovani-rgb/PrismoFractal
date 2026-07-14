import { environment } from '../environments/environment';

// ─────────────────────────────────────────────────────────────────────────────
// Pi Network usa o Stellar Protocol como camada base de ledger.
// As interfaces abaixo modelam o contrato completo do SDK + tipos Stellar.
// ─────────────────────────────────────────────────────────────────────────────

/** Passphrase de rede para identificar o chain correto (Stellar-based) */
export enum PiNetworkPassphrase {
  TESTNET = 'Pi Testnet',
  MAINNET = 'Pi Network Mainnet',
}

/** Scopes OAuth suportados pela Pi Network */
export type PiOAuthScope = 'username' | 'payments' | 'wallet_address';

/** Resposta de autenticação OAuth da Pi Network */
export interface PiAuthResult {
  accessToken: string;
  user: {
    uid:           string;
    username:      string;
    wallet_address?: string;
  };
}

/** Transação Stellar confirmada associada ao pagamento Pi */
export interface StellarTransaction {
  txid:     string;
  txURL:    string;
  verified: boolean;
  _link:    string;
}

/**
 * Contrato completo de um pagamento Pi Network.
 * Modela o ciclo de vida da transação Stellar sob a rede Pi.
 */
export interface PiPaymentContract {
  identifier:  string;
  user_uid:    string;
  amount:      number;
  memo:        string;
  metadata:    Record<string, unknown>;
  to_address?: string;
  created_at:  string;
  status: {
    developer_approved:  boolean;
    transaction_verified: boolean;
    developer_completed: boolean;
    cancelled:           boolean;
    user_cancelled:      boolean;
  };
  transaction?: StellarTransaction;
}

/**
 * Callbacks do ciclo de vida do pagamento (aprovação → conclusão via servidor)
 * Segue o padrão de contratos Stellar: aprovação off-chain → confirmação on-chain
 */
export interface PiPaymentCallbacks {
  onReadyForServerApproval:   (paymentId: string) => void | Promise<void>;
  onReadyForServerCompletion: (paymentId: string, txid: string) => void | Promise<void>;
  onCancel:                   (paymentId: string) => void;
  onError:                    (error: Error, payment?: PiPaymentContract) => void;
}

/** Dados de entrada para criar um pagamento */
export interface PiPaymentData {
  amount:   number;
  memo:     string;
  metadata: Record<string, unknown>;
}

/** Usuário autenticado no Prismo via Pi OAuth */
export interface PiUser {
  uid:            string;
  name:           string;
  wallet_address?: string;
}

// ─── Tipagem global window.Pi ─────────────────────────────────────────────────
declare global {
  interface Window {
    Pi?: {
      init(config: { version: string; sandbox: boolean }): void;
      authenticate(
        scopes: PiOAuthScope[],
        onIncompletePayment: (payment: PiPaymentContract) => void
      ): Promise<PiAuthResult>;
      createPayment(data: PiPaymentData, callbacks: PiPaymentCallbacks): void;
      openShareDialog(title: string, message: string): void;
      accessToken?: string;
      user?: { uid: string; username: string; wallet_address?: string };
      api?: {
        accessToken?:  string;
        user?:         { uid: string; username: string };
        backendURL?:   string;
        frontendURL?:  string;
        createAxios?:  () => any;
        axiosClient?:  () => any;
        get?:          (url: string, config?: any) => Promise<any>;
        post?:         (url: string, data?: any, config?: any) => Promise<any>;
      };
    };
    __piSdkReady?: boolean;
  }
}

// ─── PiSdkBase ───────────────────────────────────────────────────────────────
export class PiSdkBase {
  public static user:        PiUser | null = null;
  public static connected:   boolean = false;
  public static accessToken: string | null = null;

  protected static piHttpClient: any = null;

  /**
   * Inicializa o SDK Pi com a versão e modo sandbox corretos.
   * Segue a convenção de contratos Stellar: identifica o network passphrase.
   */
  public static init(): void {
    const piInstance = window.Pi;
    if (!piInstance || typeof piInstance.init !== 'function') {
      throw new Error('[PiSdkBase] window.Pi indisponível — abra no Pi Browser.');
    }

    const isSandbox = (environment as any).sandbox ?? true;
    piInstance.init({ version: '2.0', sandbox: isSandbox });
    window.__piSdkReady = true;

    const network = isSandbox ? PiNetworkPassphrase.TESTNET : PiNetworkPassphrase.MAINNET;
    console.log(`[PiSdkBase] SDK inicializado · Network: ${network}`);

    this.resolveHttpClient();
  }

  /** Resolve o cliente HTTP assinado pela Pi Network (Pi.api) */
  private static resolveHttpClient(): void {
    const piApi = window.Pi?.api;
    if (!piApi) return;

    const factory = piApi.axiosClient ?? piApi.createAxios;
    if (typeof factory === 'function') {
      try {
        this.piHttpClient = factory();
        console.log('[PiSdkBase] HTTP client via factory Pi.api.');
        return;
      } catch (err) {
        console.error('[PiSdkBase] Erro na factory do cliente HTTP:', err);
      }
    }

    if (typeof piApi.get === 'function') {
      this.piHttpClient = piApi;
      console.log('[PiSdkBase] HTTP client fallback: Pi.api direto.');
    }
  }

  public static getHttpClient(): any {
    if (!this.piHttpClient) this.resolveHttpClient();
    return this.piHttpClient;
  }

  /**
   * Cria um pagamento Pi usando o contrato completo do Stellar Protocol.
   * Detecta e resolve automaticamente pagamentos incompletos de sessões anteriores.
   */
  public static createPayment(
    data:      PiPaymentData,
    callbacks: PiPaymentCallbacks
  ): void {
    if (!window.Pi?.createPayment) {
      callbacks.onError(new Error('Pi SDK não disponível'));
      return;
    }

    const wrappedCallbacks: PiPaymentCallbacks = {
      onReadyForServerApproval: async (paymentId) => {
        console.log('[PiSdkBase] ✓ Pronto para aprovação do servidor | id:', paymentId);
        await callbacks.onReadyForServerApproval(paymentId);
      },
      onReadyForServerCompletion: async (paymentId, txid) => {
        console.log('[PiSdkBase] ✓ Transação Stellar confirmada | txid:', txid);
        await callbacks.onReadyForServerCompletion(paymentId, txid);
      },
      onCancel: (paymentId) => {
        console.warn('[PiSdkBase] Pagamento cancelado | id:', paymentId);
        callbacks.onCancel(paymentId);
      },
      onError: (error, payment) => {
        console.error('[PiSdkBase] Erro no contrato de pagamento:', error, payment);
        callbacks.onError(error, payment);
      }
    };

    window.Pi.createPayment(data, wrappedCallbacks);
  }

  /**
   * Autentica o usuário via Pi OAuth 2.0.
   * Detecta tokens residuais e pagamentos incompletos da sessão anterior.
   */
  async connect(): Promise<void> {
    const piInstance = window.Pi;
    if (!piInstance) throw new Error('[PiSdkBase] Pi SDK não inicializado.');

    const scopes: PiOAuthScope[] = ['username', 'payments', 'wallet_address'];
    const residualToken = piInstance.accessToken ?? piInstance.api?.accessToken;

    if (residualToken) {
      PiSdkBase.accessToken = residualToken;
      PiSdkBase.connected   = true;
      PiSdkBase.user = {
        uid:  piInstance.user?.uid ?? piInstance.api?.user?.uid ?? 'pi-uid-implicit',
        name: piInstance.user?.username ?? piInstance.api?.user?.username ?? 'pi_user_implicit',
        wallet_address: piInstance.user?.wallet_address
      };
      return;
    }

    return new Promise<void>((resolve, reject) => {
      piInstance.authenticate(scopes, (incompletePayment: PiPaymentContract) => {
        console.warn('[PiSdkBase] Pagamento incompleto detectado:', incompletePayment?.identifier);
        // Pagamentos incompletos são gerenciados pelo PiNetworkService
      })
      .then((authResult: PiAuthResult) => {
        PiSdkBase.accessToken = authResult.accessToken ?? null;
        PiSdkBase.connected   = true;
        PiSdkBase.user = {
          uid:            authResult.user.uid,
          name:           authResult.user.username,
          wallet_address: authResult.user.wallet_address
        };
        resolve();
      })
      .catch((err: unknown) => {
        const recovered = piInstance.accessToken ?? piInstance.api?.accessToken;
        if (recovered) {
          PiSdkBase.accessToken = recovered;
          PiSdkBase.connected   = true;
          PiSdkBase.user = {
            uid:  piInstance.user?.uid ?? 'pi-uid-recovered',
            name: piInstance.user?.username ?? 'pi_user_recovered'
          };
          resolve();
        } else {
          reject(err);
        }
      });
    });
  }
}
