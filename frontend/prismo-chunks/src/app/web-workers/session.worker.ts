/// <reference lib="webworker" />
import { decryptData } from '../helpers/session.helpers';

addEventListener('message', async ({ data }) => {
  const { action } = data;

  try {
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
    postMessage({ success: false, error: error.message });
  }
});

/**
 * CÁLCULO MATEMÁTICO DIFFIE-HELLMAN (Stage 0.2)
 * Realiza a interação secreta do cliente usando BigInt.
 */
async function handleHandshake(params: any) {
  const p = BigInt('0x' + params.p);
  const g = BigInt(params.g);
  const A = BigInt('0x' + params.A);

  // 1. Gera a interação secreta do cliente 'b'
  // Usamos Crypto API para aleatoriedade forte
  const bBytes = new Uint8Array(256); // 2048 bits
  self.crypto.getRandomValues(bBytes);
  const b = BigInt('0x' + Array.from(bBytes).map(b => b.toString(16).padStart(2, '0')).join('')) % p;


  const B = power(g, b, p);
  const S = power(A, b, p);

  // Garantimos que a string HEX não tenha caracteres estranhos e seja minúscula
  const bHex = B.toString(16).toLowerCase();
  const sHex = S.toString(16).toLowerCase();

  return {
    B: bHex,
    sharedSecret: sHex
  };
}




/**
 * PROCESSAMENTO DE SESSÃO (Stage 2)
 */
async function handleProcessSession(data: any) {
  const { raw, secret } = data;
  
  // 1. Descriptografia (AES-GCM)
  const session = await decryptData(raw, secret);

  if (session) {
    session.createdAt = transformJavaDate(session.createdAt);
    session.expiresAt = transformJavaDate(session.expiresAt);
    session.lastAccessAt = transformJavaDate(session.lastAccessAt);
  }

  // 2. Validação de Entropia (Porta XOR)
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
 * Função auxiliar para Exponenciação Modular (BigInt)
 * Calcula (base ^ exp) % mod de forma eficiente.
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
