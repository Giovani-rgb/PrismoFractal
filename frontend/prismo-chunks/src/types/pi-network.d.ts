// Declaração de tipos do Pi Network SDK (sdk.minepi.com/pi-sdk.js)
// Alinhada com a API v2.0 usada no PRISMO

interface PiPayment {
  identifier:  string;
  amount:      number;
  memo:        string;
  metadata:    Record<string, unknown>;
  status: {
    developer_approved:  boolean;
    transaction_verified: boolean;
    developer_completed: boolean;
    cancelled:           boolean;
    user_cancelled:      boolean;
  };
  transaction: null | {
    txid:                  string;
    verified:              boolean;
    _link:                 string;
  };
  created_at:  string;
}

interface PiAuthResult {
  accessToken: string;
  user: {
    uid:      string;
    username: string;
  };
}

interface PiSDK {
  init(options: { version: string; sandbox?: boolean }): void;
  authenticate(
    scopes:                    string[],
    onIncompletePaymentFound:  (payment: PiPayment) => void
  ): Promise<PiAuthResult>;
  createPayment(
    paymentData: { amount: number; memo: string; metadata: Record<string, unknown> },
    callbacks: {
      onReadyForServerApproval:    (paymentId: string) => void;
      onReadyForServerCompletion:  (paymentId: string, txid: string) => void;
      onCancel:                    (paymentId: string) => void;
      onError:                     (error: Error, payment: PiPayment) => void;
    }
  ): void;
}

declare global {
  interface Window {
    Pi:             PiSDK;
    __piSdkReady:   boolean;
  }
}

export {};
