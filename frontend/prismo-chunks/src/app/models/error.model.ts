/**
 * Tipos de Erros comuns no Front-End Angular
 */
export type AppErrorType =
  | 'HTTP_ERROR'        // Erros de API (4xx, 5xx)
  | 'VALIDATION_ERROR'  // Erros de formulários/inputs antes do envio
  | 'AUTH_ERROR'        // Falha de token expirado ou permissão (401/403)
  | 'NETWORK_ERROR'     // Sem internet / API offline (status 0)
  | 'CLIENT_ERROR'      // Erro de lógica no próprio código TypeScript
  | 'TIMEOUT_ERROR';    // Requisição demorou demais

export interface ErrorDetails {
  [key: string]: any;
}

/**
 * Interface padrão para o modelo de erro no Angular
 */
export interface IAppError {
  type: AppErrorType;
  message: string;
  statusCode?: number;
  details?: ErrorDetails;
  timestamp: Date;
}

/**
 * Wrapper de Erro do Angular
 */
export class AppError implements IAppError {
  public readonly timestamp: Date = new Date();

  constructor(
    public message: string,
    public type: AppErrorType = 'CLIENT_ERROR',
    public statusCode?: number,
    public details?: ErrorDetails
  ) {}

  /**
   * Helper para formatar mensagens amigáveis para o usuário final (UI)
   */
  public get friendlyMessage(): string {
    if (this.type === 'NETWORK_ERROR') {
      return 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.';
    }
    if (this.statusCode === 403) {
      return 'Você não tem permissão para realizar esta ação.';
    }
    return this.message || 'Ocorreu um erro inesperado. Tente novamente mais tarde.';
  }
}

/**
 * Gerenciador e Acumulador de Erros Reativo para Componentes/Formulários
 * Perfeito para usar em Services ou Signals/RxJS no Angular
 */
export class ErrorAccumulator {
  // Lista privada de erros acumulados
  private errorsList: AppError[] = [];

  constructor(public readonly context: string) {}

  /**
   * Adiciona um novo erro ao contexto
   */
  public add(error: AppError | string, type: AppErrorType = 'VALIDATION_ERROR', statusCode?: number): void {
    if (error instanceof AppError) {
      this.errorsList.push(error);
    } else {
      this.errorsList.push(new AppError(error, type, statusCode));
    }
  }

  /**
   * Limpa os erros (útil ao resetar um formulário ou tentar novamente)
   */
  public clear(): void {
    this.errorsList = [];
  }

  /**
   * Getters para facilitar o uso nos templates HTML (*ngIf ou @if)
   */
  public get hasErrors(): boolean {
    return this.errorsList.length > 0;
  }

  public get errors(): AppError[] {
    return [...this.errorsList];
  }

  /**
   * Retorna apenas as mensagens amigáveis em formato de array de strings
   */
  public get messages(): string[] {
    return this.errorsList.map(err => err.friendlyMessage);
  }
}
