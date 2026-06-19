import { 
  SessionTag, 
  Session, 
  PrismoSessionState, 
  DiffieHellmanModel, 
  DHResult, 
  EncryptedPayload 
} from './session.model'; // Ajuste o caminho conforme sua estrutura

/**
 * Mock de uma sessão limpa vinda do Backend/Worker
 */
export const createMockSession = (overrides?: Partial<Session>): Session => ({
  id_prospect: 'prospect_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  refs: { origin: 'webapp_handshake' },
  country: 'BR',
  revoked: false,
  keyUpdate: 'k_upd_883fa092cb',
  createdAt: 1717934400000,   // Timestamp fixo para testes determinísticos
  expiresAt: 1717941600000,   // +2 horas
  lastAccessAt: 1717934400000,
  permition: {
    rwu: true,
    navigation: ['dashboard', 'security'],
    interactions: { allow_crypto_override: true }
  },
  ...overrides
});

/**
 * Mock do Contexto Matemático do Handshake Diffie-Hellman (Stage 1)
 */
export const createMockDiffieHellmanModel = (overrides?: Partial<DiffieHellmanModel>): DiffieHellmanModel => ({
  p: 'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1', // Exemplo de Primo em Hex
  g: '02', // Gerador padrão
  _b: '7b5a193bab23cf81bc', // Privada do cliente
  B: '8a23c4d5e6f7a8b9c0',  // Pública do cliente (g^_b mod p)
  ...overrides
});

/**
 * Mock do Resultado final do cálculo DH / Shared Secret (Stage 2)
 */
export const createMockDHResult = (overrides?: Partial<DHResult>): DHResult => ({
  success: true,
  B: '8a23c4d5e6f7a8b9c0',
  _b: '7b5a193bab23cf81bc',
  sharedSecret: 'a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6', // Chave AES-GCM
  ...overrides
});

/**
 * Mock do Wrapper de Estado do Prismo (UI + Operação + Meta Cripto)
 * Centraliza os estados que a Main Thread e os Web Workers vão manipular.
 */
export const createMockPrismoSessionState = (overrides?: Partial<PrismoSessionState>): PrismoSessionState => ({
  data: createMockSession(),
  tag: SessionTag.REST,
  is_ready: true,
  is_loading: false,
  is_online: true,
  schedule_requests: false,
  use_pwa_styles: false,
  metadata: [
    createMockDiffieHellmanModel(),
    createMockDHResult()
  ],
  ...overrides
});

/**
 * Mock de Payload Criptografado trafegado na rede ou entre threads
 */
export const createMockEncryptedPayload = (overrides?: Partial<EncryptedPayload>): EncryptedPayload => ({
  ciphertext: 'U2FsdGVkX18vY3VycmVudF9zZXNzaW9uX2VuY3J5cHRlZF9ieV9hZXNfZ2NtX21vY2s=',
  iv: 'd3NmaGtkYWg4OTMyaGE=', // 12 bytes normais codificados
  ...overrides
});
