import { EncryptedPayload, DiffieHellmanModel, DHResult } from '../models/session.model';

export class SessionWorkerPipe {

  /**
   * STAGE 1: GERAÇÃO DO MATERIAL DH (CLIENT SIDE)
   * Dispara a ação STAGE_DH para computar o _b privado e o B público do cliente.
   */
  static stage_dh(params: { p: string, g: string }): Promise<DiffieHellmanModel> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../web-workers/session.worker.ts', import.meta.url));

      worker.onmessage = ({ data }) => {
        if (data.success) {
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
   */
  static calculateDH(A: string, context: DiffieHellmanModel): Promise<DHResult> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../web-workers/session.worker.ts', import.meta.url));

      worker.onmessage = ({ data }: { data: DHResult }) => {
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
        action: 'HANDSHAKE', 
        A,
        ...context 
      });
    });
  }

  /**
   * FASE 4: Encriptação de payload de identificação (reidratação via freeze token).
   * Cifra { id_prospect, ts } com o sharedSecret do vault antes de enviar ao /public.
   */
  static encryptJson(payload: object, secret: string): Promise<EncryptedPayload> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../web-workers/session.worker.ts', import.meta.url));

      worker.onmessage = ({ data }) => {
        if (data.success) {
          const { success, error, ...encrypted } = data;
          resolve(encrypted as EncryptedPayload);
        } else {
          reject(data.error);
        }
        worker.terminate();
      };

      worker.onerror = (err) => { reject(err); worker.terminate(); };

      worker.postMessage({ action: 'ENCRYPT_JSON', payload, secret });
    });
  }

  /**
   * STAGE 3: PROCESSAMENTO (DECRYPT & PORTA XOR REGRAS ANTIGAS)
   * Mantido intacto para não quebrar os fluxos antigos de sessão do ecossistema.
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

  // ─── NOVO MÉTODO ADICIONADO ──────────────────────────────────────────────────

  /**
   * DECIFRAGEM GENÉRICA DE PAYLOAD JSON (MÉTODO PURO)
   * Decifra qualquer payload criptografado via AES-GCM e retorna o objeto puro.
   * Perfeito para ler os dados do Anti-Bot (refreshPassport, minWait, status) vindos do Java.
   * * @param raw Objeto contendo o iv e o ciphertext vindos do servidor.
   * @param secret O sharedSecret para a decifragem simétrica.
   * @returns Promise contendo o JSON decifrado mapeado como objeto puro.
   */
  static decryptJson(raw: EncryptedPayload, secret: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../web-workers/session.worker.ts', import.meta.url));

      worker.onmessage = ({ data }) => {
        if (data.success) {
          // Retorna diretamente o resultado descriptografado enviado pelo worker
          // (Geralmente a propriedade que contém o payload decifrado se chama 'decrypted')
          resolve(data.decrypted || data);
        } else {
          reject(data.error);
        }
        worker.terminate();
      };

      worker.onerror = (err) => { 
        reject(err); 
        worker.terminate(); 
      };

      // Dispara a ação limpa de decifragem que seu worker já deve ter ou que herda do ENCRYPT_JSON
      worker.postMessage({ 
        action: 'DECRYPT_JSON', 
        raw, 
        secret 
      });
    });
  }
}


