export type ProviderErrorCode =
  | 'DISABLED'
  | 'INVALID_CONFIGURATION'
  | 'UNAVAILABLE'
  | 'INVALID_REQUEST'
  | 'INVALID_OUTPUT'
  | 'UNSUPPORTED'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'BUSY';

const errorMessages: Record<ProviderErrorCode, string> = {
  DISABLED: 'AI execution is disabled',
  INVALID_CONFIGURATION: 'Invalid AI provider configuration',
  UNAVAILABLE: 'AI provider is unavailable',
  INVALID_REQUEST: 'Invalid AI request',
  INVALID_OUTPUT: 'AI output did not match the required schema',
  UNSUPPORTED: 'AI provider does not support this capability',
  CANCELLED: 'AI request was cancelled',
  TIMEOUT: 'AI request deadline exceeded',
  BUSY: 'AI provider still has an unfinished request',
};

export class AIProviderError extends Error {
  constructor(public readonly code: ProviderErrorCode) {
    super(errorMessages[code]);
    this.name = 'AIProviderError';
  }
}
