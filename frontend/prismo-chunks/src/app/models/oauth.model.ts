/**
 * Constantes de operação explícitas para o ciclo de vida do sistema e OAuth
 */
export enum OAuthTag {
  VOID    = 'VOID',
  REST    = 'REST',
  OAUTH   = 'OAUTH',
  REFRESH = 'REFRESH',
  UPDATE  = 'UPDATE',
  DELETE  = 'DELETE',
  SDK_TRACK = 'SDK_TRACK',
  SDK_PROFILE = 'SDK_PROFILE',
  OFFLINE = 'OFFLINE'
}

export interface OAuthData {
  id_prospect: string;
  external_uid: string;
  username?: string;
  accessToken?: string;
  roles?: string[];
}

export interface OAuthPermition {
  scope: string[];
  authorizedAt: number;
  expiresIn: number;
  signatureValidated: boolean;
}

export interface PrismoOAuthState {
  tag: OAuthTag;
  data: OAuthData | null;
  permition: OAuthPermition | null;
  metadata?: Record<number, { timestamp: number; step: string }>;
}
