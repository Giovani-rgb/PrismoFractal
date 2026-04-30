/// <reference lib="webworker" />
import { decryptData } from '../helpers/session.helpers';
import { DiffieHellmanModel, DHResult } from '../models/session.model';

addEventListener('message', async ({ data }) => {
  const { action } = data;

  try {
    // NOVA AÇÃO: Estágio inicial para gerar B e preencher o modelo
    if (action === 'STAGE_DH') {
      const model = await handleStageDH(data);
      postMessage({ success: true, data: model } as DHResult);
      return;
    }

    // AÇÃO ORIGINAL: Cálculo imediato do Segredo (se necessário)
    if (action === 'HANDSHAKE') {
      const result = await handleHandshake(data);
      postMessage({ success: true, ...result });
      return;
    }

    if (action === 'PROCESS_SESSION') {
      const result = await handleProcessSession(data);
      postMessage({ success: true, ...result });
      return;
    }

    throw new Error(`Ação desconhecida: ${action}`);

  } catch (error: any) {
    postMessage({ success: false, error: error.message } as DHResult);
  }
});

/**
 * STAGE_DH: Geração do material do cliente (Stage 1)
 * Retorna o DiffieHellmanModel preenchido com _b e B.
 */
async function handleStageDH(params: { p: string, g: string }): Promise<DiffieHellmanModel> {
  const p = BigInt('0x' + params.p);
  const g = BigInt(params.g);

  // 1. Gera o segredo privado '_b' (2048 bits)
  const bBytes = new Uint8Array(256);
  self.crypto.getRandomValues(bBytes);
  const _bBig = BigInt('0x' + Array.from(bBytes).map(b => b.toString(16).padStart(2, '0')).join('')) % p;

  // 2. Calcula B = g^_b mod p
  const BBig = power(g, _bBig, p);

  // 3. Monta e retorna o modelo DH exato
  return {
    p: params.p,
    g: params.g,
    _b: _bBig.toString(16).toLowerCase(),
    B: BBig.toString(16).toLowerCase()
  };
}

/**
 * CÁLCULO MATEMÁTICO DIFFIE-HELLMAN (Stage 2)
 * Pode ser chamado separadamente enviando o modelo salvo no contexto.
 */
async function handleHandshake(params: any) {
  const p = BigInt('0x' + params.p);
  const g = BigInt(params.g);
  const A = BigInt('0x' + params.A);
  
  // Se vier um _b no params, usamos ele, senão geramos um novo (fallback)
  let b: bigint;
  if (params._b) {
    b = BigInt('0x' + params._b);
  } else {
    const bBytes = new Uint8Array(256);
    self.crypto.getRandomValues(bBytes);
    b = BigInt('0x' + Array.from(bBytes).map(b => b.toString(16).padStart(2, '0')).join('')) % p;
  }

  const B = power(g, b, p);
  const S = power(A, b, p);

  return {
    B: B.toString(16).toLowerCase(),
    sharedSecret: S.toString(16).toLowerCase(),
    _b: b.toString(16).toLowerCase()
  };
}

/**
 * PROCESSAMENTO DE SESSÃO (Decrypt & Porta XOR)
 */
async function handleProcessSession(data: any) {
  const { raw, secret } = data;
  const session = await decryptData(raw, secret);

  if (session) {
    session.createdAt = transformJavaDate(session.createdAt);
    session.expiresAt = transformJavaDate(session.expiresAt);
    session.lastAccessAt = transformJavaDate(session.lastAccessAt);
  }

  const size = new Blob([JSON.stringify(session)]).size;
  const density = Math.log(size || 1);

  if (!(size ^ Math.floor(density)) || size === 0 || !session?.id_prospect) {
    throw new Error("Porta XOR: Falha de veracidade ou conformidade.");
  }

  return {
    session,
    weight: (size / 1024).toFixed(2),
    density: density.toFixed(4)
  };
}

/**
 * Auxiliar: Exponenciação Modular
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

function transformJavaDate(dateData: any): number {
  if (Array.isArray(dateData) && dateData.length >= 3) {
    const [year, month, day, hour = 0, min = 0, sec = 0, ms = 0] = dateData;
    return new Date(year, month - 1, day, hour, min, sec, ms).getTime();
  }
  return typeof dateData === 'number' ? dateData : Date.now();
}
