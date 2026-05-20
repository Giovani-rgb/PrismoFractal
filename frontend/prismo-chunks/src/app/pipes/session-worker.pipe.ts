import { EncryptedPayload, DiffieHellmanModel, DHResult } from '../models/session.model';

export class SessionWorkerPipe {

  /**
   * STAGE 1: GERAÇÃO DO MATERIAL DH (CLIENT SIDE)
   * Dispara a ação STAGE_DH para computar o _b privado e o B público do cliente.
   * 
   * @param params Objeto contendo os parâmetros primos (p, g) enviados pelo servidor.
   * @returns Promise contendo o DiffieHellmanModel puro para custódia no Service/Contexto.
   */
  static stage_dh(params: { p: string, g: string }): Promise<DiffieHellmanModel> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../web-workers/session.worker.ts', import.meta.url));

      worker.onmessage = ({ data }) => {
        if (data.success) {
          // Desestrutura removendo as chaves de controle de fluxo e isola o modelo matemático
          const { success, error, ...model } = data;
          resolve(model as DiffieHellmanModel); 
        } else {
          reject(data.error);
        }
        worker.terminate();
      };

      worker.onerror = (err) => { 
        reject(err); 
        worker.terminate(); 
      };

      worker.postMessage({ 
        action: 'STAGE_DH', 
        p: params.p, 
        g: params.g 
      });
    });
  }

  /**
   * STAGE 2: FINALIZAÇÃO DO SEGREDO COMPARTILHADO (S)
   * Envia o parâmetro A do servidor acoplado com o DiffieHellmanModel completo do contexto.
   * O uso do spread operator (...context) garante espaço para enviar p, g, _b e B de uma só vez.
   * 
   * @param A Chave pública em formato hexadecimal retornada pelo servidor (Fase 1).
   * @param context Modelo matemático do Diffie-Hellman "estacionado" na memória do cliente.
   * @returns Promise contendo o contrato completo do DHResult (com a Shared Secret calculada).
   */
  static calculateDH(A: string, context: DiffieHellmanModel): Promise<DHResult> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../web-workers/session.worker.ts', import.meta.url));

      worker.onmessage = ({ data }: { data: DHResult }) => {
        if (data.success) {
          resolve(data); // Retorna o DHResult íntegro (B, sharedSecret, _b)
        } else {
          reject(data.error);
        }
        worker.terminate();
      };

      worker.onerror = (err) => { 
        reject(err); 
        worker.terminate(); 
      };

      // Injeta a ação, a chave pública do servidor (A) e espalha todo o contexto (incluindo o B)
      worker.postMessage({ 
        action: 'HANDSHAKE', 
        A,
        ...context 
      });
    });
  }

  /**
   * STAGE 3: PROCESSAMENTO (DECRYPT & PORTA XOR)
   * Envia os blocos binários para decifragem e validação de consistência estrutural.
   * 
   * @param raw Estrutura contendo o IV e o Ciphertext vindos da rota /anonymous.
   * @param secret Chave simétrica obtida através do cálculo do handshake Diffie-Hellman.
   * @returns Promise contendo o objeto de sessão higienizado e metadados de densidade da porta XOR.
   */
  static process(raw: EncryptedPayload, secret: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../web-workers/session.worker.ts', import.meta.url));

      worker.onmessage = ({ data }) => {
        if (data.success) {
          resolve(data);
        } else {
          reject(data.error);
        }
        worker.terminate();
      };

      worker.onerror = (err) => { 
        reject(err); 
        worker.terminate(); 
      };

      worker.postMessage({ 
        action: 'PROCESS_SESSION', 
        raw, 
        secret 
      });
    });
  }
}

