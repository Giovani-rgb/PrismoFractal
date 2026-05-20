/// <reference lib="webworker" />
import { decryptData } from '../helpers/session.helpers';
import { DiffieHellmanModel, DHResult } from '../models/session.model';

addEventListener('message', async ({ data }) => {
  const { action } = data;

  try {
    // FASE 1: Ignição - Gera chaves locais do cliente e retorna o modelo base
    if (action === 'STAGE_DH') {
      const model: DiffieHellmanModel = await handleStageDH(data);

      // Retorna o sucesso acoplado com as propriedades puras do DiffieHellmanModel
      postMessage({ success: true, ...model });
      return;
    }

    // FASE 2: Fechamento - Calcula a Shared Secret final e retorna o DHResult
    if (action === 'HANDSHAKE') {
      const result = await handleHandshake(data);

      const response: DHResult = {
        success: true,
        B: result.B,
        sharedSecret: result.sharedSecret,
        _b: result._b
      };

      postMessage(response);
      return;
    }

    // FASE 3: Consumo - Descriptografia do payload sanitizado vindo do Spring Boot
    if (action === 'PROCESS_SESSION') {
      const result = await handleProcessSession(data);
      postMessage({ success: true, ...result });
      return;
    }

    throw new Error(`Ação criptográfica desconhecida na esteira: ${action}`);

  } catch (error: any) {
    // Alinhamento de erro seguindo o contrato estrito de falha do DHResult
    postMessage({ success: false, error: error.message } as DHResult);
  }
});

/**
 * STAGE_DH: Primeira fase do cálculo do cliente.
 * Alinhado para retornar estritamente o DiffieHellmanModel.
 */
async function handleStageDH(params: { p: string, g: string }): Promise<DiffieHellmanModel> {
  const p = BigInt('0x' + params.p);
  const g = BigInt(params.g);

  // 1. Matriz de Entropia: Gera o segredo privado '_b' (2048 bits)
  const bBytes = new Uint8Array(256);
  self.crypto.getRandomValues(bBytes);
  const _bBig = BigInt('0x' + Array.from(bBytes).map(b => b.toString(16).padStart(2, '0')).join('')) % p;

  // 2. Cálculo modular: B = g^_b mod p
  const BBig = power(g, _bBig, p);

  return {
    p: params.p,
    g: params.g,
    _b: _bBig.toString(16).toLowerCase(),
    B: BBig.toString(16).toLowerCase()
  };
}

/**
 * HANDSHAKE: Fase final do cálculo.
 * Executa a combinação matemática utilizando a chave A do servidor e a chave privada _b.
 */
async function handleHandshake(params: DiffieHellmanModel & { A: string }) {
  const p = BigInt('0x' + params.p);
  const g = BigInt(params.g);
  const A = BigInt('0x' + params.A);

  // Resgata o _b gerado no STAGE_DH que ficou custodiado no contexto do Angular
  if (!params._b) {
    throw new Error("Handshake abortado: Chave privada primária (_b) ausente no contexto enviado.");
  }

  const b = BigInt('0x' + params._b);

  // Recalcula/Confirma B e resolve o segredo compartilhado final: S = A^_b mod p
  const B = power(g, b, p);
  const S = power(A, b, p);

  return {
    B: B.toString(16).toLowerCase(),
    sharedSecret: S.toString(16).toLowerCase(),
    _b: b.toString(16).toLowerCase()
  };
}

/**
 * PROCESS_SESSION: Descriptografia e validação por porta XOR do payload da sessão.
 */
async function handleProcessSession(data: { raw: any, secret: string }) {
  const { raw, secret } = data;
  const session = await decryptData(raw, secret);

  if (session) {
    session.createdAt = transformJavaDate(session.createdAt);
    session.expiresAt = transformJavaDate(session.expiresAt);
    session.lastAccessAt = transformJavaDate(session.lastAccessAt);
  }

  // Barreira de consistência estrutural (Porta XOR)
  const size = new Blob([JSON.stringify(session)]).size;
  const density = Math.log(size || 1);

  if (!(size ^ Math.floor(density)) || size === 0 || !session?.id_prospect) {
    throw new Error("Porta XOR: Quebra de veracidade ou payload corrompido.");
  }

  return {
    session,
    weight: (size / 1024).toFixed(2),
    density: density.toFixed(4)
  };
}

/**
 * Utilitário estável para Exponenciação Modular (Algoritmo de Quadrados Repetidos)
 */
function power(base: bigint, exp: bigint, mod: bigint): bigint {
  let res = BigInt(1);
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) res = (res * base) % mod;
    base = (base * base) % mod;
    exp = exp / 2n;
  }
  return res;
}

/**
 * Normaliza arrays de timestamps do Java LocalDateTime para o padrão Unix Epoch do JavaScript
 */
function transformJavaDate(dateData: any): number {
  if (Array.isArray(dateData) && dateData.length >= 3) {
    const [year, month, day, hour = 0, min = 0, sec = 0, ms = 0] = dateData;
    return new Date(year, month - 1, day, hour, min, sec, ms).getTime();
  }
  return typeof dateData === 'number' ? dateData : Date.now();
}
