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
