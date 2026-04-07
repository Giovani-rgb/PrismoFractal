import { EncryptedPayload, Session } from '../models/session.model';
// estas transações nao deveriam  esta em um pipe.
const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

export async function encryptData(data: Session, secret: string): Promise<EncryptedPayload> {
  const keyData = ENCODER.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'AES-GCM' }, false, ['encrypt']
  );

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

export async function decryptData(data: EncryptedPayload, secret: string): Promise<Session> {
  const keyData = ENCODER.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']
  );

  const iv = Uint8Array.from(atob(data.iv), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(data.ciphertext), c => c.charCodeAt(0));

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertext
  );

  return JSON.parse(DECODER.decode(decryptedBuffer)) as Session;
}
