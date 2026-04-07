import { EncryptedPayload, Session } from '../models/session.model';

export class SessionWorkerPipe {
  /**
   * Invoca o Web Worker e retorna uma Promise com o resultado do processamento.
   */
  static process(raw: EncryptedPayload, secret: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./session.worker.ts', import.meta.url));

      worker.onmessage = ({ data }) => {
        if (data.success) resolve(data);
        else reject(data.error);
        worker.terminate();
      };

      worker.onerror = (err) => {
        reject(err);
        worker.terminate();
      };

      worker.postMessage({ raw, secret });
    });
  }
}
