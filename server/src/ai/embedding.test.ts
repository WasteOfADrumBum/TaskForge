import {
  AIProviderError,
  createAIProvider,
  getProviderStatus,
  resolveConfiguredProvider,
  type ProviderAdapter,
} from './provider';
import { PINNED_EMBEDDING, validateEmbeddingTexts, validateEmbeddingVectors } from './embedding';
import { createOllamaAdapter, OLLAMA_RESPONSE_MAX_BYTES } from './ollama';
const vector = () => Array.from({ length: 384 }, (_, index) => (index === 0 ? 1 : 0));
const json = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const tags = { models: [{ name: PINNED_EMBEDDING.model, digest: PINNED_EMBEDDING.digest }] };
const details = {
  capabilities: ['embedding'],
  details: { format: 'gguf' },
  model_info: {
    'general.architecture': 'bert',
    'bert.context_length': 512,
    'bert.embedding_length': 384,
  },
};
const request = () => jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
const provider = (fetch: typeof globalThis.fetch, baseUrl = 'http://127.0.0.1:11435') =>
  createAIProvider(
    createOllamaAdapter({
      baseUrl,
      model: 'synthetic:latest',
      embeddingModel: PINNED_EMBEDDING.model,
      fetch,
    }),
  );
const env = { ...process.env };
afterEach(() => {
  for (const key of [
    'NODE_ENV',
    'AI_PROVIDER',
    'OLLAMA_MODEL',
    'OLLAMA_BASE_URL',
    'OLLAMA_EMBEDDING_MODEL',
  ]) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('preflights full manifest/dimensions before bounded literal texts; same signal, no truncation or downloads', async () => {
  const fetch = request()
    .mockResolvedValueOnce(json(tags))
    .mockResolvedValueOnce(json(details))
    .mockResolvedValueOnce(
      json({ model: PINNED_EMBEDDING.model, embeddings: [vector(), vector()] }),
    );
  const ai = provider(fetch);
  expect(ai.capabilities.embeddings).toBe(true);
  expect(ai.embeddingIdentity).toEqual(PINNED_EMBEDDING);
  expect(Object.isFrozen(ai.embeddingIdentity)).toBe(true);
  const texts = ['Synthetic launch note', '<script>untrusted source</script>'];
  const result = await ai.embed(texts);
  expect(result).toMatchObject({
    provider: 'ollama',
    simulation: false,
    embedding: PINNED_EMBEDDING,
    value: [vector(), vector()],
  });
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    'http://127.0.0.1:11435/api/tags',
    'http://127.0.0.1:11435/api/show',
    'http://127.0.0.1:11435/api/embed',
  ]);
  expect(JSON.parse(fetch.mock.calls[1][1]!.body as string)).toEqual({
    model: PINNED_EMBEDDING.model,
  });
  expect(JSON.parse(fetch.mock.calls[2][1]!.body as string)).toEqual({
    model: PINNED_EMBEDDING.model,
    input: texts,
    truncate: false,
    keep_alive: 0,
    options: { num_ctx: 512 },
  });
  for (const [, options] of fetch.mock.calls) {
    expect(options?.redirect).toBe('error');
    expect(options?.signal).toBe(fetch.mock.calls[0][1]?.signal);
  }
});
it.each(
  [[], [' '], Array(5).fill('text'), ['😀'.repeat(501)], [null] as unknown as string[]].map(
    (texts) => ({ texts }),
  ),
)('rejects invalid/bounded input before network (%s)', async ({ texts }) => {
  const fetch = request();
  await expect(provider(fetch).embed(texts)).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  expect(fetch).not.toHaveBeenCalled();
});
it('bounds UTF8 exactly and snapshots input before adapter invocation', async () => {
  expect(() => validateEmbeddingTexts(['😀'.repeat(500)])).not.toThrow();
  let sent: readonly string[] = [];
  const ai = createAIProvider({
    id: 'trusted',
    simulation: false,
    label: 'local',
    chat: async () => 'chat',
    structuredOutput: async () => ({}),
    embedding: {
      identity: PINNED_EMBEDDING,
      embed: async (texts) => {
        sent = texts;
        return [vector()];
      },
    },
  });
  const texts = ['original'];
  const pending = ai.embed(texts);
  texts[0] = 'changed after call';
  await pending;
  expect(sent).toEqual(['original']);
});
it.each([
  { models: [] },
  { models: [{ ...tags.models[0], digest: 'b'.repeat(64) }] },
  { models: [{ ...tags.models[0], remote_host: 'https://cloud' }] },
  { models: [tags.models[0], tags.models[0]] },
  { models: Array(101).fill(tags.models[0]) },
])('refuses unknown/mismatched/cloud model inventory before sending text %#', async (inventory) => {
  const fetch = request().mockResolvedValue(json(inventory));
  await expect(provider(fetch).embed(['private'])).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it.each([
  { ...details, remote_model: 'cloud' },
  { ...details, capabilities: ['completion'] },
  { ...details, details: { format: 'remote' } },
  { ...details, model_info: { ...details.model_info, 'bert.embedding_length': 768 } },
  { ...details, model_info: { ...details.model_info, 'bert.context_length': 2048 } },
])('refuses incompatible preflight before document traffic %#', async (metadata) => {
  const fetch = request().mockResolvedValueOnce(json(tags)).mockResolvedValueOnce(json(metadata));
  await expect(provider(fetch).embed(['private'])).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  expect(fetch).toHaveBeenCalledTimes(2);
});
it.each(
  [
    [],
    [vector(), vector()],
    [vector().slice(1)],
    [Array(384).fill(0)],
    [Array(384).fill(null)],
    [Array(384).fill('1')],
    [Array(384).fill(1e308)],
  ].map((embeddings) => ({ embeddings })),
)('rejects malformed/count/dimension/zero/overflow vectors %#', async ({ embeddings }) => {
  const fetch = request()
    .mockResolvedValueOnce(json(tags))
    .mockResolvedValueOnce(json(details))
    .mockResolvedValueOnce(json({ model: PINNED_EMBEDDING.model, embeddings }));
  await expect(provider(fetch).embed(['text'])).rejects.toMatchObject({ code: 'INVALID_OUTPUT' });
});
it('rejects nonfinite adapter vectors not representable by JSON', () => {
  expect(validateEmbeddingVectors([Array(384).fill(NaN)], 1, PINNED_EMBEDDING)).toBe(false);
  expect(validateEmbeddingVectors([Array(384).fill(Infinity)], 1, PINNED_EMBEDDING)).toBe(false);
});
it.each([
  { model: 'wrong', embeddings: [vector()] },
  { model: PINNED_EMBEDDING.model, remote_host: 'cloud', embeddings: [vector()] },
])('rejects incompatible inference identity %#', async (output) => {
  const fetch = request()
    .mockResolvedValueOnce(json(tags))
    .mockResolvedValueOnce(json(details))
    .mockResolvedValueOnce(json(output));
  await expect(provider(fetch).embed(['text'])).rejects.toMatchObject({ code: 'INVALID_OUTPUT' });
});
it('keeps production disabled and optional local configuration honest without model probes', async () => {
  const fetch = request();
  process.env.AI_PROVIDER = 'ollama';
  process.env.OLLAMA_MODEL = 'synthetic';
  process.env.OLLAMA_EMBEDDING_MODEL = PINNED_EMBEDDING.model;
  expect(getProviderStatus().capabilities.embeddings).toBe(true);
  process.env.NODE_ENV = 'production';
  expect(getProviderStatus().capabilities.embeddings).toBe(false);
  await expect(resolveConfiguredProvider().embed(['text'])).rejects.toMatchObject({
    code: 'DISABLED',
  });
  expect(() => provider(fetch)).toThrow(AIProviderError);
  expect(fetch).not.toHaveBeenCalled();
});
it('rejects an already-constructed adapter after environment switches to production', async () => {
  const fetch = request();
  const ai = provider(fetch);
  process.env.NODE_ENV = 'production';
  await expect(ai.embed(['text'])).rejects.toMatchObject({ code: 'DISABLED' });
  expect(fetch).not.toHaveBeenCalled();
});
it('rejects production switching during metadata before document traffic', async () => {
  const fetch = request().mockImplementation(async () => {
    process.env.NODE_ENV = 'production';
    return json(tags);
  });
  await expect(provider(fetch).embed(['private'])).rejects.toMatchObject({ code: 'DISABLED' });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it.each(['http://remote.example:11434', 'https://127.0.0.1:11434', 'http://127.1:11434'])(
  'rejects remote/alias embedding endpoints %s',
  (baseUrl) => {
    const fetch = request();
    expect(() => provider(fetch, baseUrl)).toThrow(AIProviderError);
    expect(fetch).not.toHaveBeenCalled();
  },
);
it.each(['all-minilm:latest', 'other:cloud', ' all-minilm:l6-v2'])(
  'rejects non-pinned model configuration %s',
  (embeddingModel) => {
    const fetch = request();
    expect(() => createOllamaAdapter({ model: 'synthetic', embeddingModel, fetch })).toThrow(
      AIProviderError,
    );
    expect(fetch).not.toHaveBeenCalled();
  },
);
it('keeps embeddings unsupported without explicit setting and in simulation', async () => {
  delete process.env.OLLAMA_EMBEDDING_MODEL;
  const fetch = request();
  const ai = createAIProvider(createOllamaAdapter({ model: 'synthetic', fetch }));
  expect(ai.capabilities.embeddings).toBe(false);
  await expect(ai.embed(['text'])).rejects.toMatchObject({ code: 'UNSUPPORTED' });
  await expect(resolveConfiguredProvider({ mode: 'demo' }).embed(['text'])).rejects.toMatchObject({
    code: 'UNSUPPORTED',
  });
  expect(fetch).not.toHaveBeenCalled();
});
it('cancels before traffic and shares capacity with chat through uncooperative late settlement', async () => {
  const controller = new AbortController();
  controller.abort();
  const fetch = request();
  await expect(
    provider(fetch).embed(['text'], { signal: controller.signal }),
  ).rejects.toMatchObject({ code: 'CANCELLED' });
  expect(fetch).not.toHaveBeenCalled();
  jest.useFakeTimers();
  let release!: (value: unknown) => void;
  const adapter: ProviderAdapter = {
    id: 'trusted',
    simulation: false,
    label: 'local',
    chat: async () => 'text',
    structuredOutput: async () => ({}),
    embedding: {
      identity: PINNED_EMBEDDING,
      embed: () =>
        new Promise((done) => {
          release = done;
        }),
    },
  };
  const ai = createAIProvider(adapter);
  const pending = ai.embed(['text'], { timeoutMs: 10 });
  const expectation = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
  await jest.advanceTimersByTimeAsync(10);
  await expectation;
  await expect(ai.chat([{ role: 'user', content: 'text' }])).rejects.toMatchObject({
    code: 'BUSY',
  });
  await expect(ai.embed(['text'])).rejects.toMatchObject({ code: 'BUSY' });
  release([vector()]);
  await jest.advanceTimersByTimeAsync(0);
  expect((await ai.chat([{ role: 'user', content: 'text' }])).value).toBe('text');
});
it('bounds metadata response body and sanitizes malformed/network failures', async () => {
  const oversized = new Response(' '.repeat(OLLAMA_RESPONSE_MAX_BYTES + 1), {
    headers: { 'Content-Type': 'application/json' },
  });
  const fetch = request().mockResolvedValue(oversized);
  await expect(provider(fetch).embed(['text'])).rejects.toMatchObject({ code: 'INVALID_OUTPUT' });
  expect(fetch).toHaveBeenCalledTimes(1);
  const network = request().mockRejectedValue(new Error('sensitive upstream detail'));
  await expect(provider(network).embed(['text'])).rejects.toMatchObject({
    code: 'UNAVAILABLE',
    message: expect.not.stringContaining('sensitive'),
  });
});

it('rejects false simulation/manifest capability adapters before invocation', () => {
  const adapter: ProviderAdapter = {
    id: 'trusted',
    simulation: true,
    label: 'demo',
    chat: async () => '',
    structuredOutput: async () => ({}),
    embedding: { identity: PINNED_EMBEDDING, embed: async () => [vector()] },
  };
  expect(() => createAIProvider(adapter)).toThrow(AIProviderError);
  expect(() =>
    createAIProvider({
      ...adapter,
      simulation: false,
      embedding: {
        ...adapter.embedding!,
        identity: { ...PINNED_EMBEDDING, digest: 'b'.repeat(64) },
      },
    }),
  ).toThrow(AIProviderError);
});
it('rejects embedding result after a mid-inference production switch', async () => {
  const fetch = request()
    .mockResolvedValueOnce(json(tags))
    .mockResolvedValueOnce(json(details))
    .mockImplementationOnce(async () => {
      process.env.NODE_ENV = 'production';
      return json({ model: PINNED_EMBEDDING.model, embeddings: [vector()] });
    });
  await expect(provider(fetch).embed(['text'])).rejects.toMatchObject({ code: 'DISABLED' });
});
it('cancels metadata work without proceeding to model input or replay', async () => {
  const controller = new AbortController();
  const fetch = request().mockImplementation(async (_url, options) => {
    controller.abort();
    expect(options?.signal?.aborted).toBe(true);
    return json(tags);
  });
  await expect(
    provider(fetch).embed(['private'], { signal: controller.signal }),
  ).rejects.toMatchObject({ code: 'CANCELLED' });
  expect(fetch).toHaveBeenCalledTimes(1);
});
