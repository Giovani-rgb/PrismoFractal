import { EncryptedPayload } from '../models/session.model';

export class SessionWorkerPipe {
  /**
   * STAGE 0: HANDSHAKE MATEMÁTICO
   * Invoca o Worker para realizar a exponenciação modular pesada.
   * @param params Objeto contendo { p, g, A } em Hexadecimal vindos do Stage 0.1.
   */
  static calculateDH(params: { p: string, g: string, A: string }): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../web-workers/session.worker.ts', import.meta.url));

      worker.onmessage = ({ data }) => {
        if (data.success) resolve(data);
        else reject(data.error);
        worker.terminate();
      };

      worker.onerror = (err) => {
        reject(err);
        worker.terminate();
      };

      // Dispara a ação de Handshake para o Worker
      worker.postMessage({ 
        action: 'HANDSHAKE', 
        p: params.p, 
        g: params.g, 
        A: params.A 
      });
    });
  }

  /**
   * STAGE 2: PROCESSAMENTO (DECRYPT & MAP)
   * Invoca o Web Worker para descriptografar o AES-GCM e mapear a sessão.
   */
  static process(raw: EncryptedPayload, secret: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../web-workers/session.worker.ts', import.meta.url));

      worker.onmessage = ({ data }) => {
        if (data.success) resolve(data);
        else reject(data.error);
        worker.terminate();
      };

      worker.onerror = (err) => {
        reject(err);
        worker.terminate();
      };

      // Dispara a ação de processamento de payload
      worker.postMessage({ 
        action: 'PROCESS_SESSION', 
        raw, 
        secret 
      });
    });
  }
}
