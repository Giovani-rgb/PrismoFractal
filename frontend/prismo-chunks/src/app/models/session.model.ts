export enum SessionTag {
  CREATE = 'CREATE',
  REHYDRATE = 'REHYDRATE',
  UPDATE = 'UPDATE',
  OFFLINE = 'OFFLINE',
  PWA = 'PWA',
  VOID = 'VOID',
  REST = 'REST',
  PUBLIC = 'PUBLIC'
}

/**
 * O objeto Session original (vinda do Backend/Worker)
 */
export interface Session {
  id_prospect: string;
  refs: any;
  country: string;
  revoked: boolean;
  keyUpdate: string;
  createdAt: number;
  expiresAt: number;
  lastAccessAt: number;
  token?: string;
}

/**
 * O Wrapper de Estado do Prismo (UI + Operação)
 */
export interface PrismoSessionState {
  data: Session | null;
  tag: SessionTag;
  
  // Tags de Controle (Booleans)
  is_ready: boolean;          // Objeto em Repouso (REST)
  is_loading: boolean;        // Operação em curso
  is_online: boolean;
  schedule_requests: boolean; // Modo Agendamento (Offline)
  use_pwa_styles: boolean;    // Modo Fullscreen (340px)
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
}

export interface DiffieHellmanModel {
  p: string;  // Módulo Primo (Hex)
  g: string;  // Gerador (Hex)
  _b: string; // Expoente Privado do Cliente (Hex) - O "segredo"
  B: string;  // Chave Pública do Cliente (Hex) - Produto: g^_b mod p
}

/**
 * DTO para o transporte entre Worker e Main Thread
 */
export interface DHResult {
  success: boolean;
  B?: string;
  _b?: string;      // Retornado para o Service guardar em memória
  sharedSecret?: string;
  error?: string;
}
