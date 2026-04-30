import { EncryptedPayload, DiffieHellmanModel, DHResult } from '../models/session.model';

export class SessionWorkerPipe {

  /**
   * STAGE 1: GERAÇÃO DO MATERIAL DH (CLIENT SIDE)
   * Invoca a ação STAGE_DH para gerar o _b privado e o B público.
   * Retorna o modelo completo para ser armazenado no contexto do Service.
   */
  static stage_dh(params: { p: string, g: string }): Promise<DiffieHellmanModel> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../web-workers/session.worker.ts', import.meta.url));

      worker.onmessage = ({ data }: { data: DHResult & { data: DiffieHellmanModel } }) => {
        if (data.success) {
          // data.data contém o DiffieHellmanModel preenchido pelo Worker
          resolve(data.data); 
        } else {
          reject(data.error);
        }
        worker.terminate();
      };

      worker.onerror = (err) => { reject(err); worker.terminate(); };

      worker.postMessage({ 
        action: 'STAGE_DH', 
        p: params.p, 
        g: params.g 
      });
    });
  }

  /**
   * STAGE 2: FINALIZAÇÃO DO SEGREDO COMPARTILHADO (S)
   * Recebe o A do servidor e o modelo DH guardado no contexto.
   */
  static calculateDH(A: string, context: DiffieHellmanModel): Promise<{ sharedSecret: string }> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../web-workers/session.worker.ts', import.meta.url));

      worker.onmessage = ({ data }) => {
        if (data.success) resolve(data);
        else reject(data.error);
        worker.terminate();
      };

      worker.onerror = (err) => { reject(err); worker.terminate(); };

      // Aqui usamos o _b e o p que foram "estacionados" no modelo anteriormente
      worker.postMessage({ 
        action: 'HANDSHAKE', 
        p: context.p, 
        g: context.g,
        A: A,
        _b: context._b 
      });
    });
  }

  /**
   * STAGE 3: PROCESSAMENTO (DECRYPT & PORTA XOR)
   */
  static process(raw: EncryptedPayload, secret: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../web-workers/session.worker.ts', import.meta.url));

      worker.onmessage = ({ data }) => {
        if (data.success) resolve(data);
        else reject(data.error);
        worker.terminate();
      };

      worker.onerror = (err) => { reject(err); worker.terminate(); };

      worker.postMessage({ 
        action: 'PROCESS_SESSION', 
        raw, 
        secret 
      });
    });
  }
}
