import { EncryptedPayload, Session } from '../models/session.model';
// estas transações nao deveriam  esta em um pipe.
const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

async function deriveKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  const raw = ENCODER.encode(secret);
  const hash = await crypto.subtle.digest('SHA-256', raw);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, usage);
}

export async function encryptData(data: Session, secret: string): Promise<EncryptedPayload> {
  const cryptoKey = await deriveKey(secret, ['encrypt']);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ENCODER.encode(JSON.stringify(data))
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv))
  };
}

/**
 * Encripta qualquer objeto JSON com AES-256-GCM usando o sharedSecret.
 * Usado na reidratação para cifrar o payload de identificação { id_prospect, ts }.
 */
export async function encryptJson(payload: object, secret: string): Promise<EncryptedPayload> {
  const cryptoKey = await deriveKey(secret, ['encrypt']);

  const iv         = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ENCODER.encode(JSON.stringify(payload))
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv:         btoa(String.fromCharCode(...iv))
  };
}

export async function decryptData(data: EncryptedPayload, secret: string): Promise<Session> {
  const cryptoKey = await deriveKey(secret, ['decrypt']);

  const iv = Uint8Array.from(atob(data.iv), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(data.ciphertext), c => c.charCodeAt(0));

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertext
  );

  return JSON.parse(DECODER.decode(decryptedBuffer)) as Session;
}
