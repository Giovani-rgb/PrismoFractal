import { environment } from '../environments/environment'; // Ajuste seu import do env

declare global {
  interface Window {
    Pi?: {
      init(config: { version: string; sandbox: boolean }): void;
      authenticate(scopes: string[], onIncompletePayment: (payment: any) => void): Promise<any>;
      accessToken?: string;
      user?: { uid: string; username: string };
      // 1. Tipagem fiel ao dump do objeto real exposto no console
      api?: {
        accessToken?: string;
        user?: { uid: string; username: string };
        backendURL?: string;
        frontendURL?: string;
        createAxios?: () => any;
        axiosClient?: () => any;
        get?: (url: string, config?: any) => Promise<any>;
        post?: (url: string, data?: any, config?: any) => Promise<any>;
      };
    };
    __piSdkReady?: boolean;
  }
}

export interface PiUser {
  uid: string;
  name: string;
}

export class PiSdkBase {
  public static user: PiUser | null = null;
  public static connected: boolean = false;
  public static accessToken: string | null = null;
  
  // Guardará a instância configurada/assinada apropriada
  protected static piHttpClient: any = null;

  public static init(): void {
    const piInstance = window.Pi;
    if (piInstance && typeof piInstance.init === 'function') {
      const isSandbox = (environment as any).sandbox ?? true;
      piInstance.init({ version: '2.0', sandbox: isSandbox });
      window.__piSdkReady = true;
      
      this.initializeHttpClient();
    } else {
      throw new Error('Script global window.Pi indisponível.');
    }
  }

  /**
   * Resolve e extrai o cliente HTTP assinado respeitando a árvore correta (window.Pi.api)
   */
  private static initializeHttpClient(): void {
    const piApi = window.Pi?.api;
    if (!piApi) return;

    // 2. Tenta usar o axiosClient ou o createAxios diretamente do escopo de api
    const resolverFactory = piApi.axiosClient || piApi.createAxios;
    
    if (typeof resolverFactory === 'function') {
      try {
        // Executa a factory para obter a instância Axios com os interceptors injetados
        this.piHttpClient = resolverFactory();
        console.log('[Pi SDK Base] Instância Axios obtida via factory da API.');
      } catch (err) {
        console.error('[Pi SDK Base] Erro ao executar factory do Axios:', err);
      }
    }

    // Fallback: Se a factory falhar ou não retornar, usamos o próprio objeto api
    // que possui o método get() direto mapeado no dump
    if (!this.piHttpClient && typeof piApi.get === 'function') {
      this.piHttpClient = piApi;
      console.log('[Pi SDK Base] Usando objeto Pi.api como cliente HTTP fallback.');
    }
  }

  /**
   * Retorna o cliente HTTP preparado para efetuar requests seguros (evitando Erro 0)
   */
  public static getHttpClient(): any {
    if (!this.piHttpClient) {
      this.initializeHttpClient();
    }
    return this.piHttpClient;
  }

  async connect(): Promise<void> {
    const piInstance = window.Pi;
    if (!piInstance) throw new Error("Pi SDK não inicializado.");

    const scopes = ['username', 'payments', 'wallet_address'];
    const existingToken = piInstance.accessToken || piInstance.api?.accessToken;

    if (existingToken) {
      PiSdkBase.accessToken = existingToken;
      PiSdkBase.connected = true;
      PiSdkBase.user = {
        uid: piInstance.user?.uid || piInstance.api?.user?.uid || 'pi-uid-implicit',
        name: piInstance.user?.username || piInstance.api?.user?.username || 'pi_user_implicit'
      };
      return;
    }

    return new Promise((resolve, reject) => {
      piInstance.authenticate(scopes, (payment: any) => {
        console.warn('[Pi SDK] Transação pendente:', payment?.identifier);
      })
      .then((authResponse: any) => {
        PiSdkBase.accessToken = authResponse?.accessToken || null;
        PiSdkBase.connected = true;
        PiSdkBase.user = {
          uid: authResponse?.user?.uid,
          name: authResponse?.user?.username
        };
        resolve();
      })
      .catch((err: any) => {
        const residualToken = piInstance.accessToken || piInstance.api?.accessToken;
        if (residualToken) {
          PiSdkBase.accessToken = residualToken;
          PiSdkBase.connected = true;
          PiSdkBase.user = {
            uid: piInstance.user?.uid || 'pi-uid-recovered',
            name: piInstance.user?.username || 'pi_user_recovered'
          };
          resolve();
        } else {
          reject(err);
        }
      });
    });
  }
}
