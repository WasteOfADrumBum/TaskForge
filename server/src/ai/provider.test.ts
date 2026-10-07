import { inspect } from 'node:util';
import { performance } from 'node:perf_hooks';
import {
  AIProviderError,
  createAIProvider,
  DEMO_LABEL,
  DEMO_SUMMARY,
  getProviderStatus,
  resolveConfiguredProvider,
  type ProviderAdapter,
  type ProviderErrorCode,
  type RuntimeSchema,
} from './provider';

const messages = [{ role: 'user' as const, content: 'Summarize this synthetic task' }];
const adapter = (overrides: Partial<ProviderAdapter> = {}): ProviderAdapter => ({
  id: 'test-local',
  simulation: false,
  label: 'Local test adapter',
  chat: async () => 'Real adapter result',
  structuredOutput: async () => ({ count: 2 }),
  ...overrides,
});
const countSchema = {
  validate: (value: unknown): value is { count: number } =>
    typeof value === 'object' &&
    value !== null &&
    'count' in value &&
    typeof value.count === 'number',
};
const errorCode = async (operation: Promise<unknown>): Promise<ProviderErrorCode | null> => {
  try {
    await operation;
    return null;
  } catch (error) {
    expect(error).toBeInstanceOf(AIProviderError);
    return (error as AIProviderError).code;
  }
};

const originalProvider = process.env.AI_PROVIDER;
afterEach(() => {
  if (originalProvider === undefined) delete process.env.AI_PROVIDER;
  else process.env.AI_PROVIDER = originalProvider;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it.each([undefined, '', 'disabled', 'demo'])(
  'defaults %s configuration to disabled execution',
  async (configuredProvider) => {
    delete process.env.AI_PROVIDER;
    const provider = resolveConfiguredProvider({ configuredProvider });
    expect(provider.id).toBe('disabled');
    expect(provider.capabilities).toEqual({
      chat: false,
      structuredOutput: false,
      embeddings: false,
    });
    expect(await errorCode(provider.chat(messages))).toBe('DISABLED');
    expect(await errorCode(provider.structuredOutput(messages, countSchema))).toBe('DISABLED');
    expect(await errorCode(provider.embed(['synthetic']))).toBe('DISABLED');
  },
);

it.each(['disabled', 'demo'])(
  'allows explicitly selected simulation with %s configuration',
  async (configuredProvider) => {
    const provider = resolveConfiguredProvider({ configuredProvider, mode: 'demo' });
    const chat = await provider.chat(messages);
    expect(chat).toEqual({
      value: DEMO_LABEL + ' ' + DEMO_SUMMARY,
      provider: 'demo',
      simulation: true,
      label: DEMO_LABEL,
    });
    const schema = {
      validate: (value: unknown): value is { summary: string; simulated: true } =>
        typeof value === 'object' &&
        value !== null &&
        'summary' in value &&
        typeof value.summary === 'string' &&
        'simulated' in value &&
        value.simulated === true,
    };
    expect(await provider.structuredOutput(messages, schema)).toMatchObject({
      value: { summary: DEMO_SUMMARY, simulated: true },
      simulation: true,
      label: DEMO_LABEL,
    });
    expect(await errorCode(provider.embed(['synthetic']))).toBe('UNSUPPORTED');
    expect(await errorCode(provider.structuredOutput(messages, countSchema))).toBe(
      'INVALID_OUTPUT',
    );
  },
);

it('reads configuration at call time rather than freezing imported environment', async () => {
  process.env.AI_PROVIDER = 'demo';
  expect(resolveConfiguredProvider().id).toBe('disabled');
  process.env.AI_PROVIDER = 'ollama';
  expect(() => resolveConfiguredProvider()).toThrow(
    expect.objectContaining({ code: 'UNAVAILABLE' }),
  );
  process.env.AI_PROVIDER = 'disabled';
  expect(resolveConfiguredProvider().id).toBe('disabled');
});

it.each(['openai', 'https://secret.example?key=private', ' demo ', 'paid'])(
  'rejects unknown configuration %s without echoing it or falling back',
  (configuredProvider) => {
    expect(() => resolveConfiguredProvider({ configuredProvider, mode: 'demo' })).toThrow(
      expect.objectContaining({
        code: 'INVALID_CONFIGURATION',
        message: 'Invalid AI provider configuration',
      }),
    );
    const status = getProviderStatus(configuredProvider);
    expect(status).toMatchObject({
      configuredProvider: 'invalid',
      reason: 'invalid_configuration',
      available: false,
    });
    expect(JSON.stringify(status)).not.toContain(configuredProvider);
  },
);

it('reports local inference unavailable without silently selecting demo', () => {
  expect(getProviderStatus('ollama')).toMatchObject({
    configuredProvider: 'ollama',
    reason: 'unavailable',
    defaultMode: 'disabled',
    available: false,
    demoSupported: true,
  });
  expect(() => resolveConfiguredProvider({ configuredProvider: 'ollama' })).toThrow(
    expect.objectContaining({ code: 'UNAVAILABLE' }),
  );
  expect(() => resolveConfiguredProvider({ configuredProvider: 'ollama', mode: 'demo' })).toThrow(
    expect.objectContaining({ code: 'UNAVAILABLE' }),
  );
});

it('returns safe disabled status and frozen capability objects', () => {
  delete process.env.AI_PROVIDER;
  const status = getProviderStatus();
  expect(status).toMatchObject({
    configuredProvider: 'disabled',
    defaultMode: 'disabled',
    reason: 'disabled',
    available: false,
    demoSupported: true,
    capabilities: { chat: false, structuredOutput: false, embeddings: false },
    simulationCapabilities: { chat: true, structuredOutput: true, embeddings: false },
  });
  expect(Object.isFrozen(status.capabilities)).toBe(true);
});

it('preserves local adapter provenance and validates generic structured output', async () => {
  const provider = createAIProvider(adapter());
  expect(await provider.chat(messages)).toEqual({
    value: 'Real adapter result',
    provider: 'test-local',
    simulation: false,
    label: 'Local test adapter',
  });
  expect(await provider.structuredOutput(messages, countSchema)).toMatchObject({
    value: { count: 2 },
    simulation: false,
  });
});

it('rejects invalid output and validators that throw', async () => {
  const provider = createAIProvider(
    adapter({ structuredOutput: async () => ({ count: 'wrong' }) }),
  );
  expect(await errorCode(provider.structuredOutput(messages, countSchema))).toBe('INVALID_OUTPUT');
  const throwingSchema = {
    validate: (_value: unknown): _value is never => {
      throw new Error('Internal schema detail');
    },
  };
  expect(await errorCode(provider.structuredOutput(messages, throwingSchema))).toBe(
    'INVALID_OUTPUT',
  );
});

it.each([0, -1, 120001, NaN, 0.5])(
  'rejects invalid deadline %s without calling the adapter',
  async (timeoutMs) => {
    const chat = jest.fn(async () => 'unused');
    expect(await errorCode(createAIProvider(adapter({ chat })).chat(messages, { timeoutMs }))).toBe(
      'INVALID_REQUEST',
    );
    expect(chat).not.toHaveBeenCalled();
  },
);

it('rejects malformed messages without adapter work', async () => {
  const chat = jest.fn(async () => 'unused');
  const provider = createAIProvider(adapter({ chat }));
  expect(await errorCode(provider.chat([]))).toBe('INVALID_REQUEST');
  expect(await errorCode(provider.chat([{ role: 'user', content: 'x'.repeat(64001) }]))).toBe(
    'INVALID_REQUEST',
  );
  expect(chat).not.toHaveBeenCalled();
});

it('sanitizes adapter rejection without leaking internal details', async () => {
  const provider = createAIProvider(
    adapter({
      chat: async () => {
        throw new Error('secret URL and credential');
      },
    }),
  );
  await expect(provider.chat(messages)).rejects.toMatchObject({
    code: 'UNAVAILABLE',
    message: 'AI provider is unavailable',
  });
});

it('does not begin adapter work for an already-cancelled request', async () => {
  const controller = new AbortController();
  controller.abort();
  const chat = jest.fn(async () => 'unused');
  expect(
    await errorCode(
      createAIProvider(adapter({ chat })).chat(messages, { signal: controller.signal }),
    ),
  ).toBe('CANCELLED');
  expect(chat).not.toHaveBeenCalled();
});

it('bounds an uncooperative adapter and holds its guard until late settlement', async () => {
  jest.useFakeTimers();
  let settle!: (value: string) => void;
  let receivedSignal!: AbortSignal;
  const chat = jest.fn((_messages, options) => {
    receivedSignal = options.signal;
    return new Promise<string>((resolve) => {
      settle = resolve;
    });
  });
  const provider = createAIProvider(adapter({ chat }));
  const pending = errorCode(provider.chat(messages, { timeoutMs: 10 }));
  await jest.advanceTimersByTimeAsync(10);
  expect(await pending).toBe('TIMEOUT');
  expect(receivedSignal.aborted).toBe(true);
  expect(await errorCode(provider.chat(messages))).toBe('BUSY');
  expect(chat).toHaveBeenCalledTimes(1);
  settle('late');
  await jest.advanceTimersByTimeAsync(0);
  // The completed caller remains timed out; only subsequent work can begin again.
  chat.mockImplementation(async () => 'next');
  expect((await provider.chat(messages)).value).toBe('next');
  expect(jest.getTimerCount()).toBe(0);
});

it('cancels active work, handles a late rejection, and removes listeners/timers', async () => {
  jest.useFakeTimers();
  let rejectLate!: (error: Error) => void;
  const controller = new AbortController();
  const remove = jest.spyOn(controller.signal, 'removeEventListener');
  const provider = createAIProvider(
    adapter({
      chat: () =>
        new Promise((_resolve, reject) => {
          rejectLate = reject;
        }),
    }),
  );
  const pending = errorCode(provider.chat(messages, { signal: controller.signal }));
  await Promise.resolve();
  controller.abort();
  expect(await pending).toBe('CANCELLED');
  expect(await errorCode(provider.chat(messages))).toBe('BUSY');
  rejectLate(new Error('late network failure'));
  await Promise.resolve();
  await Promise.resolve();
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(jest.getTimerCount()).toBe(0);
});

it('keeps cancellation separate from adapter cancellation rejection', async () => {
  const controller = new AbortController();
  const provider = createAIProvider(
    adapter({
      chat: (_messages, { signal }) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new Error('AbortError')), { once: true }),
        ),
    }),
  );
  const pending = errorCode(provider.chat(messages, { signal: controller.signal }));
  await Promise.resolve();
  controller.abort();
  expect(await pending).toBe('CANCELLED');
});

it('rejects truthy or asynchronous runtime validators rather than accepting unchecked output', async () => {
  const provider = createAIProvider(adapter());
  for (const validate of [() => 'truthy', () => Promise.resolve(true)]) {
    const schema = { validate } as unknown as RuntimeSchema<{ count: number }>;
    expect(await errorCode(provider.structuredOutput(messages, schema))).toBe('INVALID_OUTPUT');
  }
});

it('rejects nontext adapter chat output and unsupported embeddings', async () => {
  const chat = jest.fn(async () => 42 as unknown as string);
  const provider = createAIProvider(adapter({ chat }));
  expect(await errorCode(provider.chat(messages))).toBe('INVALID_OUTPUT');
  expect(await errorCode(provider.embed(['synthetic']))).toBe('UNSUPPORTED');
  expect(chat).toHaveBeenCalledTimes(1);
});

it('rejects an unknown runtime selection mode without implicit simulation', () => {
  expect(() =>
    resolveConfiguredProvider({ configuredProvider: 'disabled', mode: 'automatic' as 'demo' }),
  ).toThrow(expect.objectContaining({ code: 'INVALID_REQUEST' }));
});

it('rejects synchronous schema validation that has already exceeded its real deadline', async () => {
  const provider = createAIProvider(adapter());
  const slowSchema = {
    validate: (value: unknown): value is { count: number } => {
      const stop = performance.now() + 20;
      while (performance.now() < stop) {
        /* Deliberately occupy the event loop. */
      }
      return countSchema.validate(value);
    },
  };
  expect(await errorCode(provider.structuredOutput(messages, slowSchema, { timeoutMs: 1 }))).toBe(
    'TIMEOUT',
  );
});

// Native Promise inspection is test-only: a queued abort after fulfillment must not
// retroactively invalidate a completed operation. This fixture measures the real boundary.
it.each([2, 3, 4, 5])(
  'honors cancellation relative to public completion at settlement depth %s',
  async (depth) => {
    const controller = new AbortController();
    let pendingAtAbort: boolean | undefined;
    let signalAbortFinished!: () => void;
    const abortFinished = new Promise<void>((resolve) => {
      signalAbortFinished = resolve;
    });
    const after = (remaining: number): void => {
      if (remaining) queueMicrotask(() => after(remaining - 1));
      else {
        pendingAtAbort = inspect(pending).includes('<pending>');
        controller.abort();
        signalAbortFinished();
      }
    };
    const provider = createAIProvider(
      adapter({
        chat: () =>
          Promise.resolve('value').then((value) => {
            queueMicrotask(() => after(depth));
            return value;
          }),
      }),
    );
    const pending = provider.chat(messages, { signal: controller.signal });
    const outcome = await errorCode(pending);
    await abortFinished;
    expect(typeof pendingAtAbort).toBe('boolean');
    expect(outcome).toBe(pendingAtAbort ? 'CANCELLED' : null);
    expect(controller.signal.aborted).toBe(true);
  },
);
