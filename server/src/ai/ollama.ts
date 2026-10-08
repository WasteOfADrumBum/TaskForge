import { AIProviderError } from './errors';
import { PINNED_EMBEDDING, readEmbeddingModel } from './embedding';
import type { ChatMessage, ProviderAdapter } from './provider';

export const OLLAMA_RESPONSE_MAX_BYTES = 1024 * 1024;
export interface OllamaConfiguration {
  baseUrl: string;
  model: string;
}

export const readOllamaConfiguration = (
  options: { baseUrl?: string; model?: string } = {},
): OllamaConfiguration => {
  const baseUrl = options.baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
  const model = options.model ?? process.env.OLLAMA_MODEL;
  // Validate the literal authority, before URL canonicalization can turn numeric aliases into localhost.
  if (
    baseUrl !== baseUrl.trim() ||
    !/^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::[1-9]\d{0,4})?\/?$/.test(baseUrl)
  ) {
    throw new AIProviderError('INVALID_CONFIGURATION');
  }
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new AIProviderError('INVALID_CONFIGURATION');
  }
  if (
    !model ||
    model !== model.trim() ||
    model.length > 120 ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*(?::[a-zA-Z0-9._-]+)?$/.test(model) ||
    /(?:^|[:/-])cloud(?:$|[:/-])/i.test(model)
  ) {
    throw new AIProviderError('INVALID_CONFIGURATION');
  }
  // Pin localhost to numeric loopback so hostname resolution cannot redirect a local call.
  if (parsed.hostname === 'localhost') parsed.hostname = '127.0.0.1';
  return { baseUrl: parsed.origin, model };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const hasRemote = (value: Record<string, unknown>) =>
  ['remote_model', 'remote_host'].some((key) => value[key] !== undefined && value[key] !== '');

const readJson = async (
  response: Response,
  signal: AbortSignal,
): Promise<Record<string, unknown>> => {
  if (!response.ok || response.redirected) {
    void response.body?.cancel().catch(() => {});
    throw new AIProviderError('UNAVAILABLE');
  }
  if (
    !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') ||
    !response.body
  ) {
    void response.body?.cancel().catch(() => {});
    throw new AIProviderError('INVALID_OUTPUT');
  }
  const reader = response.body.getReader();
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener('abort', cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > OLLAMA_RESPONSE_MAX_BYTES) {
        cancel();
        throw new AIProviderError('INVALID_OUTPUT');
      }
      chunks.push(chunk.value);
    }
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
    } catch {
      throw new AIProviderError('INVALID_OUTPUT');
    }
    if (!isRecord(value)) throw new AIProviderError('INVALID_OUTPUT');
    return value;
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
};

export const createOllamaAdapter = (
  options: {
    baseUrl?: string;
    model?: string;
    embeddingModel?: string;
    fetch?: typeof globalThis.fetch;
  } = {},
): ProviderAdapter => {
  if (process.env.NODE_ENV === 'production') throw new AIProviderError('DISABLED');
  const config = readOllamaConfiguration(options);
  const embeddingModel = readEmbeddingModel(options.embeddingModel);
  const fetchRequest = options.fetch ?? globalThis.fetch;
  const post = async (path: string, body: Record<string, unknown>, signal: AbortSignal) => {
    if (process.env.NODE_ENV === 'production') throw new AIProviderError('DISABLED');
    signal.throwIfAborted();
    const response = await fetchRequest(config.baseUrl + path, {
      method: 'POST',
      redirect: 'error',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (signal.aborted) {
      void response.body?.cancel().catch(() => {});
      signal.throwIfAborted();
    }
    return readJson(response, signal);
  };
  const embed = async (texts: readonly string[], { signal }: { signal: AbortSignal }) => {
    if (process.env.NODE_ENV === 'production') throw new AIProviderError('DISABLED');
    signal.throwIfAborted();
    // Tags verify the full model manifest without ever pulling or sending document text.
    const response = await fetchRequest(config.baseUrl + '/api/tags', {
      redirect: 'error',
      signal,
    });
    if (signal.aborted) {
      void response.body?.cancel().catch(() => {});
      signal.throwIfAborted();
    }
    const tags = await readJson(response, signal);
    if (hasRemote(tags) || !Array.isArray(tags.models) || tags.models.length > 100)
      throw new AIProviderError('UNAVAILABLE');
    const models = tags.models.filter((model) => isRecord(model) && model.name === embeddingModel);
    if (
      models.length !== 1 ||
      !isRecord(models[0]) ||
      hasRemote(models[0]) ||
      models[0].digest !== PINNED_EMBEDDING.digest
    )
      throw new AIProviderError('UNAVAILABLE');
    const details = await post('/api/show', { model: embeddingModel }, signal);
    if (
      hasRemote(details) ||
      !isRecord(details.details) ||
      details.details.format !== 'gguf' ||
      !isRecord(details.model_info) ||
      details.model_info['general.architecture'] !== 'bert' ||
      details.model_info['bert.embedding_length'] !== PINNED_EMBEDDING.dimensions ||
      details.model_info['bert.context_length'] !== 512 ||
      !Array.isArray(details.capabilities) ||
      !details.capabilities.includes('embedding')
    )
      throw new AIProviderError('UNAVAILABLE');
    const result = await post(
      '/api/embed',
      {
        model: embeddingModel,
        input: [...texts],
        truncate: false,
        keep_alive: 0,
        options: { num_ctx: 512 },
      },
      signal,
    );
    if (hasRemote(result) || result.model !== embeddingModel)
      throw new AIProviderError('INVALID_OUTPUT');
    return result.embeddings;
  };
  const generate = async (
    messages: readonly ChatMessage[],
    signal: AbortSignal,
    format?: string | Record<string, unknown>,
  ) => {
    // No prompt/history is sent until local model metadata has passed the cloud boundary.
    const details = await post('/api/show', { model: config.model }, signal);
    if (
      hasRemote(details) ||
      !isRecord(details.details) ||
      details.details.format !== 'gguf' ||
      !isRecord(details.model_info) ||
      !Array.isArray(details.capabilities) ||
      !details.capabilities.includes('completion')
    ) {
      throw new AIProviderError('UNAVAILABLE');
    }
    const result = await post(
      '/api/chat',
      {
        model: config.model,
        messages: messages.map(({ role, content }) => ({ role, content })),
        stream: false,
        think: false,
        options: { temperature: 0, num_predict: format === undefined ? 256 : 512, num_ctx: 2048 },
        ...(format !== undefined && { format }),
      },
      signal,
    );
    if (
      hasRemote(result) ||
      result.done !== true ||
      result.done_reason !== 'stop' ||
      !isRecord(result.message) ||
      result.message.role !== 'assistant' ||
      typeof result.message.content !== 'string'
    ) {
      throw new AIProviderError('INVALID_OUTPUT');
    }
    return result.message.content;
  };
  return {
    ...(embeddingModel && { embedding: { identity: PINNED_EMBEDDING, embed } }),
    id: 'ollama',
    simulation: false,
    label: 'Local Ollama inference; no hosted provider.',
    chat: (messages, { signal }) => generate(messages, signal),
    structuredOutput: async (messages, { signal }, schema) => {
      const text = await generate(messages, signal, schema ?? 'json');
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new AIProviderError('INVALID_OUTPUT');
      }
    },
  };
};
