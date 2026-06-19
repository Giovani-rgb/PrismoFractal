import { AppError, ErrorAccumulator, AppErrorType, ErrorDetails } from './error.model'; // Ajuste o caminho

/**
 * Cria uma instância real de AppError com dados customizáveis.
 * Mantém o comportamento dos getters (ex: friendlyMessage) intacto para os testes.
 */
export const createMockAppError = (
  message = 'Ocorreu um erro no processamento.',
  type: AppErrorType = 'CLIENT_ERROR',
  statusCode?: number,
  details?: ErrorDetails
): AppError => {
  return new AppError(message, type, statusCode, details);
};

/**
 * Atalhos para cenários comuns de erro, evitando repetição de boilerplate nos specs
 */
export const MockErrors = {
  http500: () => createMockAppError('Internal Server Error', 'HTTP_ERROR', 500, { route: '/api/session' }),

  http403: () => createMockAppError('Forbidden Action', 'AUTH_ERROR', 403, { requiredRole: 'ADMIN' }),

  network: () => createMockAppError('Failed to fetch', 'NETWORK_ERROR', 0),

  validation: (fields: ErrorDetails = { email: 'E-mail inválido' }) => 
    createMockAppError('Campos obrigatórios ou inválidos', 'VALIDATION_ERROR', 420, fields),

  timeout: () => createMockAppError('The gateway timed out', 'TIMEOUT_ERROR', 504)
};

/**
 * Cria uma instância populada de ErrorAccumulator para testar a reatividade da UI
 * ou validações de formulários no Angular.
 */
export const createMockErrorAccumulator = (
  context = 'TEST_CONTEXT',
  prePopulateErrors: { message: string; type?: AppErrorType; statusCode?: number }[] = []
): ErrorAccumulator => {
  const accumulator = new ErrorAccumulator(context);

  prePopulateErrors.forEach(err => {
    accumulator.add(err.message, err.type, err.statusCode);
  });

  return accumulator;
};
