import { createOllamaAdapter, OLLAMA_RESPONSE_MAX_BYTES, readOllamaConfiguration } from './ollama';
import {
  AIProviderError,
  createAIProvider,
  getProviderStatus,
  resolveConfiguredProvider,
} from './provider';

const messages = [{ role: 'user' as const, content: 'Synthetic local-only task' }];
const localDetails = {
  details: { format: 'gguf' },
  model_info: { architecture: 'qwen3' },
  capabilities: ['completion'],
};
const reply = (content = 'Local result') => ({
  done: true,
  done_reason: 'stop',
  message: { role: 'assistant', content },
});
const json = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const fetchMock = () => jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
const local = (request: typeof fetch) =>
  createAIProvider(
    createOllamaAdapter({
      model: 'synthetic:latest',
      baseUrl: 'http://127.0.0.1:11435',
      fetch: request,
    }),
  );
const env = { ...process.env };
afterEach(() => {
  for (const key of ['NODE_ENV', 'AI_PROVIDER', 'OLLAMA_MODEL', 'OLLAMA_BASE_URL']) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  jest.restoreAllMocks();
});

it('preflights a local model without messages, then generates nonstreamed chat with shared cancellation', async () => {
  const request = fetchMock()
    .mockResolvedValueOnce(json(localDetails))
    .mockResolvedValueOnce(json(reply()));
  const result = await local(request).chat(messages);
  expect(result).toMatchObject({ provider: 'ollama', simulation: false, value: 'Local result' });
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[0][0]).toBe('http://127.0.0.1:11435/api/show');
  expect(JSON.parse(request.mock.calls[0][1]!.body as string)).toEqual({
    model: 'synthetic:latest',
  });
  expect(request.mock.calls[1][0]).toBe('http://127.0.0.1:11435/api/chat');
  expect(JSON.parse(request.mock.calls[1][1]!.body as string)).toMatchObject({
    model: 'synthetic:latest',
    stream: false,
    messages,
  });
  expect(request.mock.calls[0][1]!.signal).toBe(request.mock.calls[1][1]!.signal);
  expect(request.mock.calls[0][1]!.redirect).toBe('error');
  expect(request.mock.calls[1][1]!.redirect).toBe('error');
});

it.each([
  undefined,
  { type: 'object', properties: { count: { type: 'number' } }, required: ['count'] },
])(
  'guides structured JSON output and still applies runtime validation (%s)',
  async (jsonSchema) => {
    const request = fetchMock()
      .mockResolvedValueOnce(json(localDetails))
      .mockResolvedValueOnce(json(reply('{"count":2}')));
    const schema = {
      jsonSchema,
      validate: (value: unknown): value is { count: number } =>
        typeof value === 'object' &&
        value !== null &&
        'count' in value &&
        typeof value.count === 'number',
    };
    expect((await local(request).structuredOutput(messages, schema)).value).toEqual({ count: 2 });
    expect(JSON.parse(request.mock.calls[1][1]!.body as string).format).toEqual(
      jsonSchema ?? 'json',
    );
  },
);

it.each(['not JSON', '{"count":"wrong"}'])(
  'rejects invalid structured output %s',
  async (content) => {
    const request = fetchMock()
      .mockResolvedValueOnce(json(localDetails))
      .mockResolvedValueOnce(json(reply(content)));
    await expect(
      local(request).structuredOutput(messages, {
        validate: (value: unknown): value is { count: number } =>
          typeof value === 'object' &&
          value !== null &&
          'count' in value &&
          typeof value.count === 'number',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_OUTPUT' });
  },
);

it.each([
  'https://127.0.0.1:11434',
  'http://example.com',
  'http://127.0.0.2:11434',
  'http://127.1:11434',
  'http://2130706433:11434',
  'http://localhost.example',
  'http://user:secret@localhost:11434',
  'http://localhost:11434/api',
  'http://localhost:11434/?token=secret',
  'http://localhost:11434/#hash',
  'http://localhost:99999',
  'http://localhost:11434/../',
  'http://localhost:11434\n',
])('rejects unsafe base URL %s before any request', (baseUrl) => {
  const request = fetchMock();
  expect(() => createOllamaAdapter({ baseUrl, model: 'synthetic', fetch: request })).toThrow(
    expect.objectContaining({ code: 'INVALID_CONFIGURATION' }),
  );
  expect(request).not.toHaveBeenCalled();
});

it.each(['http://127.0.0.1:11434', 'http://localhost:11434/', 'http://[::1]:11434'])(
  'accepts only explicit loopback HTTP origin %s',
  (baseUrl) => {
    expect(readOllamaConfiguration({ baseUrl, model: 'synthetic' })).toMatchObject({
      model: 'synthetic',
    });
  },
);

it.each([
  'model:cloud',
  'model-cloud',
  'cloud/model',
  'model:latest-cloud',
  'cloud',
  'model cloud',
  'https://remote/model',
  '',
  'model:latest\n',
])('rejects remote or invalid model names %s before any request', (model) => {
  const request = fetchMock();
  expect(() => createOllamaAdapter({ model, fetch: request })).toThrow(AIProviderError);
  expect(request).not.toHaveBeenCalled();
});

it.each([
  { ...localDetails, remote_model: 'cloud-model' },
  { ...localDetails, remote_host: 'https://ollama.com' },
  { ...localDetails, remote_model: null },
  { details: { format: 'gguf' }, capabilities: ['completion'] },
  { ...localDetails, details: { format: 'remote' } },
  { ...localDetails, capabilities: ['embedding'] },
])('rejects remote/unknown model metadata without sending any messages (%s)', async (details) => {
  const request = fetchMock().mockResolvedValueOnce(json(details));
  await expect(local(request).chat(messages)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][1]!.body).not.toContain(messages[0].content);
});

it('does not use the adapter in production even with local configuration', async () => {
  process.env.NODE_ENV = 'production';
  process.env.AI_PROVIDER = 'ollama';
  process.env.OLLAMA_MODEL = 'synthetic';
  process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11435';
  const request = jest.spyOn(globalThis, 'fetch');
  const provider = resolveConfiguredProvider();
  expect(getProviderStatus()).toMatchObject({
    defaultMode: 'disabled',
    reason: 'disabled',
    available: false,
  });
  await expect(provider.chat(messages)).rejects.toMatchObject({ code: 'DISABLED' });
  expect(resolveConfiguredProvider({ mode: 'demo' }).id).toBe('demo');
  expect(request).not.toHaveBeenCalled();
});

it('rechecks the production boundary after an adapter was created', async () => {
  const request = fetchMock();
  const provider = local(request);
  process.env.NODE_ENV = 'production';
  await expect(provider.chat(messages)).rejects.toMatchObject({ code: 'DISABLED' });
  expect(request).not.toHaveBeenCalled();
});

it.each([
  new Response('secret upstream error', { status: 500 }),
  new Response('', { status: 302, headers: { Location: 'https://remote.example' } }),
])('rejects unavailable/redirect responses without forwarding messages', async (response) => {
  const request = fetchMock().mockResolvedValueOnce(response);
  await expect(local(request).chat(messages)).rejects.toMatchObject({
    code: 'UNAVAILABLE',
    message: 'AI provider is unavailable',
  });
  expect(request).toHaveBeenCalledTimes(1);
});

it('sanitizes native fetch failures without retrying', async () => {
  const request = fetchMock().mockRejectedValue(new Error('internal URL and credential'));
  await expect(local(request).chat(messages)).rejects.toMatchObject({
    code: 'UNAVAILABLE',
    message: 'AI provider is unavailable',
  });
  expect(request).toHaveBeenCalledTimes(1);
});

it.each(['not JSON', JSON.stringify([])])('rejects malformed preflight JSON (%s)', async (body) => {
  const request = fetchMock().mockResolvedValueOnce(
    new Response(body, { headers: { 'Content-Type': 'application/json' } }),
  );
  await expect(local(request).chat(messages)).rejects.toMatchObject({ code: 'INVALID_OUTPUT' });
  expect(request).toHaveBeenCalledTimes(1);
});

it('rejects oversized metadata before messages and cancels its reader', async () => {
  const cancelled = jest.fn();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(OLLAMA_RESPONSE_MAX_BYTES + 1));
    },
    cancel: cancelled,
  });
  const request = fetchMock().mockResolvedValueOnce(
    new Response(stream, { headers: { 'Content-Type': 'application/json' } }),
  );
  await expect(local(request).chat(messages)).rejects.toMatchObject({ code: 'INVALID_OUTPUT' });
  expect(cancelled).toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(1);
});

it('bounds stalled response bodies and cancels the owned reader', async () => {
  const cancelled = jest.fn();
  const stream = new ReadableStream<Uint8Array>({ cancel: cancelled });
  const request = fetchMock().mockResolvedValueOnce(
    new Response(stream, { headers: { 'Content-Type': 'application/json' } }),
  );
  await expect(local(request).chat(messages, { timeoutMs: 10 })).rejects.toMatchObject({
    code: 'TIMEOUT',
  });
  expect(cancelled).toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(1);
});

it('cancels stalled preflight fetch without sending messages or leaking its later error', async () => {
  const caller = new AbortController();
  const request = fetchMock().mockImplementation(
    (_url, options) =>
      new Promise((_resolve, reject) =>
        options!.signal!.addEventListener('abort', () => reject(new Error('network aborted')), {
          once: true,
        }),
      ),
  );
  const pending = local(request).chat(messages, { signal: caller.signal });
  await Promise.resolve();
  caller.abort();
  await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
  expect(request).toHaveBeenCalledTimes(1);
});

it.each([
  { ...reply(), remote_host: 'https://remote.example' },
  { done: false, message: { role: 'assistant', content: 'partial' } },
  { done: true, message: { role: 'assistant', content: 4 } },
])('rejects remote or malformed chat output (%s)', async (result) => {
  const request = fetchMock()
    .mockResolvedValueOnce(json(localDetails))
    .mockResolvedValueOnce(json(result));
  await expect(local(request).chat(messages)).rejects.toMatchObject({ code: 'INVALID_OUTPUT' });
});

it('rejects an oversized inference body without returning partial output', async () => {
  const request = fetchMock()
    .mockResolvedValueOnce(json(localDetails))
    .mockResolvedValueOnce(json(reply('x'.repeat(OLLAMA_RESPONSE_MAX_BYTES + 1))));
  await expect(local(request).chat(messages)).rejects.toMatchObject({ code: 'INVALID_OUTPUT' });
  expect(request).toHaveBeenCalledTimes(2);
});

it('cancels inference body reading after a successful local preflight', async () => {
  const caller = new AbortController();
  const cancelled = jest.fn();
  const stream = new ReadableStream<Uint8Array>({ cancel: cancelled });
  const request = fetchMock()
    .mockResolvedValueOnce(json(localDetails))
    .mockImplementationOnce(async () => {
      queueMicrotask(() => caller.abort());
      return new Response(stream, { headers: { 'Content-Type': 'application/json' } });
    });
  await expect(local(request).chat(messages, { signal: caller.signal })).rejects.toMatchObject({
    code: 'CANCELLED',
  });
  expect(request).toHaveBeenCalledTimes(2);
  expect(cancelled).toHaveBeenCalled();
});

it.each([undefined, null, 'length', 'cancelled', 'load'])(
  'rejects incomplete chat completion reason %s',
  async (doneReason) => {
    const request = fetchMock()
      .mockResolvedValueOnce(json(localDetails))
      .mockResolvedValueOnce(json({ ...reply('partial text'), done_reason: doneReason }));
    await expect(local(request).chat(messages)).rejects.toMatchObject({ code: 'INVALID_OUTPUT' });
  },
);

it.each([undefined, null, 'length', 'cancelled', 'load'])(
  'rejects incomplete structured completion reason %s even when JSON matches',
  async (doneReason) => {
    const request = fetchMock()
      .mockResolvedValueOnce(json(localDetails))
      .mockResolvedValueOnce(
        json({ ...reply('{"summary":"Partial but valid JSON"}'), done_reason: doneReason }),
      );
    const schema = {
      validate: (value: unknown): value is { summary: string } =>
        typeof value === 'object' &&
        value !== null &&
        'summary' in value &&
        typeof value.summary === 'string',
    };
    await expect(local(request).structuredOutput(messages, schema)).rejects.toMatchObject({
      code: 'INVALID_OUTPUT',
    });
  },
);

it('pins accepted localhost configuration to numeric IPv4 before any outbound request', async () => {
  const request = fetchMock()
    .mockResolvedValueOnce(json(localDetails))
    .mockResolvedValueOnce(json(reply()));
  const provider = createAIProvider(
    createOllamaAdapter({ baseUrl: 'http://localhost:11435/', model: 'synthetic', fetch: request }),
  );
  await provider.chat(messages);
  expect(request.mock.calls.map(([url]) => url)).toEqual([
    'http://127.0.0.1:11435/api/show',
    'http://127.0.0.1:11435/api/chat',
  ]);
  expect(
    readOllamaConfiguration({ baseUrl: 'http://[::1]:11435', model: 'synthetic' }).baseUrl,
  ).toBe('http://[::1]:11435');
});

it('keeps chat256 and structured512 token ceilings while retaining bounded no-cloud request settings', async () => {
  const request = fetchMock()
    .mockResolvedValueOnce(json(localDetails))
    .mockResolvedValueOnce(json(reply('Chat')))
    .mockResolvedValueOnce(json(localDetails))
    .mockResolvedValueOnce(json(reply('{"summary":"Valid"}')));
  const provider = local(request);
  await provider.chat(messages);
  await provider.structuredOutput(
    messages,
    {
      jsonSchema: { type: 'object' },
      validate: (value: unknown): value is { summary: string } =>
        !!value && typeof value === 'object' && 'summary' in value,
    },
    { timeoutMs: 1000 },
  );
  const chatBody = JSON.parse(request.mock.calls[1][1]!.body as string);
  const structuredBody = JSON.parse(request.mock.calls[3][1]!.body as string);
  expect(chatBody.options).toMatchObject({ num_predict: 256, num_ctx: 2048, temperature: 0 });
  expect(structuredBody.options).toMatchObject({ num_predict: 512, num_ctx: 2048, temperature: 0 });
});
