/// <reference lib="webworker" />

interface EncryptedPayload {
  ciphertext: string;
  iv: string;
}

interface WorkerInput {
  raw: EncryptedPayload;
  secret: string;
}

self.onmessage = async ({ data }: MessageEvent<WorkerInput>) => {
  const { raw, secret } = data;

  try {
    const session = await decryptAesGcm(raw, secret);

    // Métricas internas para auditoria (Stage 3)
    const serialized  = JSON.stringify(session);
    const weight      = parseFloat((new Blob([serialized]).size / 1024).toFixed(3));
    const density     = computeEntropy(serialized);

    self.postMessage({ success: true, session, density, weight });

  } catch (err: any) {
    self.postMessage({ success: false, error: err?.message ?? 'Falha no worker de sessão' });
  }
};

/**
 * Descriptografa payload AES-GCM recebido do backend.
 * Espelha a mesma lógica do ServiceSession.java (EncryptionUtils).
 */
async function decryptAesGcm(payload: EncryptedPayload, secret: string): Promise<any> {
  const keyData = new TextEncoder().encode(secret);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const iv         = Uint8Array.from(atob(payload.iv),         c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(payload.ciphertext), c => c.charCodeAt(0));

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertext
  );

  return JSON.parse(new TextDecoder().decode(decryptedBuffer));
}

/**
 * Calcula a entropia de Shannon da string (bits por caractere).
 * Usado como métrica de densidade no Stage 3 da esteira.
 */
function computeEntropy(str: string): number {
  const freq: Record<string, number> = {};
  for (const ch of str) freq[ch] = (freq[ch] ?? 0) + 1;

  return Object.values(freq).reduce((entropy, count) => {
    const p = count / str.length;
    return entropy - p * Math.log2(p);
  }, 0);
}
