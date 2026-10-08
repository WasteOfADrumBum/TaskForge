import { performance } from 'node:perf_hooks';

import { AIProviderError } from './errors';
import {
  PINNED_EMBEDDING,
  readEmbeddingModel,
  validateEmbeddingTexts,
  validateEmbeddingVectors,
  type EmbeddingIdentity,
} from './embedding';
import { createOllamaAdapter, readOllamaConfiguration } from './ollama';

export { AIProviderError, type ProviderErrorCode } from './errors';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderOptions {
  signal?: AbortSignal;
  // One deadline for the entire operation, including output validation.
  timeoutMs?: number;
}

export interface RuntimeSchema<T> {
  validate: (value: unknown) => value is T;
  jsonSchema?: Record<string, unknown>;
}

export interface ProviderCapabilities {
  chat: boolean;
  structuredOutput: boolean;
  embeddings: boolean;
}

export interface ProviderResult<T> {
  // Embed results carry the immutable identity that chunk storage/query compatibility must persist.
  embedding?: Readonly<EmbeddingIdentity>;
  value: T;
  provider: string;
  simulation: boolean;
  label: string;
}

export interface AIProvider {
  readonly embeddingIdentity?: Readonly<EmbeddingIdentity>;
  readonly id: string;
  readonly capabilities: Readonly<ProviderCapabilities>;
  chat(
    messages: readonly ChatMessage[],
    options?: ProviderOptions,
  ): Promise<ProviderResult<string>>;
  structuredOutput<T>(
    messages: readonly ChatMessage[],
    schema: RuntimeSchema<T>,
    options?: ProviderOptions,
  ): Promise<ProviderResult<T>>;
  embed(texts: readonly string[], options?: ProviderOptions): Promise<ProviderResult<number[][]>>;
}

// A trusted server adapter injection point. Environment selection never accepts arbitrary factories.
export interface ProviderAdapter {
  readonly embedding?: {
    readonly identity: Readonly<EmbeddingIdentity>;
    embed(texts: readonly string[], options: { signal: AbortSignal }): Promise<unknown>;
  };
  readonly id: string;
  readonly simulation: boolean;
  readonly label: string;
  chat(messages: readonly ChatMessage[], options: { signal: AbortSignal }): Promise<string>;
  structuredOutput(
    messages: readonly ChatMessage[],
    options: { signal: AbortSignal },
    schema?: Record<string, unknown>,
  ): Promise<unknown>;
}

const supportedCapabilities = Object.freeze({
  chat: true,
  structuredOutput: true,
  embeddings: false,
});
const disabledCapabilities = Object.freeze({
  chat: false,
  structuredOutput: false,
  embeddings: false,
});

const validateMessages = (messages: readonly ChatMessage[]) => {
  if (!Array.isArray(messages) || !messages.length || messages.length > 100) {
    throw new AIProviderError('INVALID_REQUEST');
  }
  let characters = 0;
  for (const message of messages) {
    if (
      !message ||
      !['system', 'user', 'assistant'].includes(message.role) ||
      typeof message.content !== 'string'
    ) {
      throw new AIProviderError('INVALID_REQUEST');
    }
    characters += message.content.length;
  }
  if (characters > 64000) throw new AIProviderError('INVALID_REQUEST');
};

// Reuse a provider instance. Its guard remains held until the underlying adapter settles,
// even when it ignores cancellation, so repeated requests cannot accumulate hanging work.
export const createAIProvider = (adapter: ProviderAdapter): AIProvider => {
  const embedding = adapter.embedding;
  if (
    embedding &&
    (adapter.simulation ||
      embedding.identity.model !== PINNED_EMBEDDING.model ||
      embedding.identity.digest !== PINNED_EMBEDDING.digest ||
      embedding.identity.dimensions !== PINNED_EMBEDDING.dimensions ||
      typeof embedding.embed !== 'function')
  )
    throw new AIProviderError('INVALID_CONFIGURATION');
  const embeddingIdentity = embedding ? PINNED_EMBEDDING : undefined;
  let active = false;
  const invoke = async <T>(
    operation: (signal: AbortSignal) => Promise<T>,
    options: ProviderOptions = {},
  ): Promise<ProviderResult<T>> => {
    const timeoutMs = options.timeoutMs ?? 30000;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) {
      throw new AIProviderError('INVALID_REQUEST');
    }
    if (options.signal?.aborted) throw new AIProviderError('CANCELLED');
    if (active) throw new AIProviderError('BUSY');
    active = true;
    const controller = new AbortController();
    const deadline = performance.now() + timeoutMs;
    let interruptionReason: 'CANCELLED' | 'TIMEOUT' | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel: () => void = () => {};
    const interrupted = new Promise<never>((_resolve, reject) => {
      cancel = () => {
        interruptionReason ??= 'CANCELLED';
        reject(new AIProviderError(interruptionReason));
        controller.abort();
      };
      options.signal?.addEventListener('abort', cancel, { once: true });
      timer = setTimeout(() => {
        interruptionReason ??= 'TIMEOUT';
        reject(new AIProviderError(interruptionReason));
        controller.abort();
      }, timeoutMs);
    });
    const operationPromise = Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new AIProviderError(interruptionReason ?? 'CANCELLED');
      return operation(controller.signal);
    });
    const release = () => {
      active = false;
    };
    // Handle both branches, including late rejections after the caller already timed out.
    void operationPromise.then(release, release);
    try {
      const value = await Promise.race([operationPromise, interrupted]);
      // Settlement can win the race before cancellation or a blocked timer is observed.
      // Recheck at the final response boundary, using elapsed monotonic time as well.
      interruptionReason ??= options.signal?.aborted ? 'CANCELLED' : undefined;
      interruptionReason ??= performance.now() >= deadline ? 'TIMEOUT' : undefined;
      if (interruptionReason) {
        controller.abort();
        throw new AIProviderError(interruptionReason);
      }
      return { value, provider: adapter.id, simulation: adapter.simulation, label: adapter.label };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError('UNAVAILABLE');
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
    }
  };
  return {
    id: adapter.id,
    embeddingIdentity,
    capabilities: Object.freeze({ ...supportedCapabilities, embeddings: !!embedding }),
    chat: (messages, options) => {
      try {
        validateMessages(messages);
      } catch (error) {
        return Promise.reject(error);
      }
      return invoke(async (signal) => {
        const value = await adapter.chat(messages, { signal });
        if (typeof value !== 'string') throw new AIProviderError('INVALID_OUTPUT');
        return value;
      }, options);
    },
    structuredOutput: (messages, schema, options) => {
      try {
        validateMessages(messages);
        if (!schema || typeof schema.validate !== 'function')
          throw new AIProviderError('INVALID_REQUEST');
      } catch (error) {
        return Promise.reject(error);
      }
      return invoke(async (signal) => {
        const value = await adapter.structuredOutput(messages, { signal }, schema.jsonSchema);
        try {
          if (schema.validate(value) !== true) throw new AIProviderError('INVALID_OUTPUT');
        } catch {
          throw new AIProviderError('INVALID_OUTPUT');
        }
        return value;
      }, options);
    },
    embed: async (texts, options) => {
      if (!embedding || !embeddingIdentity) throw new AIProviderError('UNSUPPORTED');
      if (process.env.NODE_ENV === 'production') throw new AIProviderError('DISABLED');
      validateEmbeddingTexts(texts);
      // Snapshot caller input before an await; mutations must not change the bounded request.
      const snapshot = [...texts];
      const result = await invoke(async (signal) => {
        const value = await embedding.embed(snapshot, { signal });
        if (process.env.NODE_ENV === 'production') throw new AIProviderError('DISABLED');
        if (!validateEmbeddingVectors(value, snapshot.length, embeddingIdentity))
          throw new AIProviderError('INVALID_OUTPUT');
        return value;
      }, options);
      return { ...result, embedding: embeddingIdentity };
    },
  };
};

const createDisabledProvider = (): AIProvider => {
  const disabled = async (): Promise<never> => {
    throw new AIProviderError('DISABLED');
  };
  return {
    id: 'disabled',
    capabilities: disabledCapabilities,
    chat: disabled,
    structuredOutput: disabled,
    embed: disabled,
  };
};

export const DEMO_LABEL = 'Simulation: canned response; no AI model was called.';
export const DEMO_SUMMARY = 'This is a fixed TaskForge demo result. Review it as simulated output.';

const createDemoProvider = () =>
  createAIProvider({
    id: 'demo',
    simulation: true,
    label: DEMO_LABEL,
    chat: async () => DEMO_LABEL + ' ' + DEMO_SUMMARY,
    structuredOutput: async () => ({ summary: DEMO_SUMMARY, simulated: true }),
  });

export interface ProviderStatus {
  configuredProvider: 'disabled' | 'demo' | 'ollama' | 'invalid';
  defaultMode: 'disabled' | 'local';
  available: false;
  reason: 'disabled' | 'not_verified' | 'invalid_configuration';
  demoSupported: true;
  capabilities: Readonly<ProviderCapabilities>;
  simulationCapabilities: Readonly<ProviderCapabilities>;
}

// Never echo unknown configuration values: they could contain URLs or credentials.
export const getProviderStatus = (configuredProvider = process.env.AI_PROVIDER): ProviderStatus => {
  const configured =
    configuredProvider === undefined || configuredProvider === '' ? 'disabled' : configuredProvider;
  const name =
    configured === 'disabled' || configured === 'demo' || configured === 'ollama'
      ? configured
      : 'invalid';
  let reason: ProviderStatus['reason'] = name === 'invalid' ? 'invalid_configuration' : 'disabled';
  if (name === 'ollama' && process.env.NODE_ENV !== 'production') {
    try {
      readOllamaConfiguration();
      readEmbeddingModel();
      reason = 'not_verified';
    } catch {
      reason = 'invalid_configuration';
    }
  }
  const local = reason === 'not_verified';
  return {
    configuredProvider: name,
    defaultMode: local ? 'local' : 'disabled',
    available: false,
    reason,
    demoSupported: true,
    capabilities: local
      ? Object.freeze({ ...supportedCapabilities, embeddings: readEmbeddingModel() !== undefined })
      : disabledCapabilities,
    simulationCapabilities: supportedCapabilities,
  };
};

export const resolveConfiguredProvider = (
  options: { mode?: 'demo'; configuredProvider?: string } = {},
): AIProvider => {
  const status = getProviderStatus(options.configuredProvider);
  if (status.reason === 'invalid_configuration') throw new AIProviderError('INVALID_CONFIGURATION');
  if (options.mode !== undefined && options.mode !== 'demo')
    throw new AIProviderError('INVALID_REQUEST');
  // Even AI_PROVIDER=demo does not select simulation without this per-call opt-in.
  if (options.mode === 'demo') return createDemoProvider();
  return status.defaultMode === 'local'
    ? createAIProvider(createOllamaAdapter())
    : createDisabledProvider();
};
