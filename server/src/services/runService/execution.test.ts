import { Run } from '../../models/runModel';
import * as permission from '../permissionService';
import * as audit from '../auditService';
import * as runs from './index';
import { createRunExecutor } from './execution';
import type { AIProvider } from '../../ai/provider';
const owner = '507f1f77bcf86cd799439011';
const id = '507f1f77bcf86cd799439012';
const agent = '507f1f77bcf86cd799439013';
const initial = () =>
  new Run({
    _id: id,
    owner,
    task: id,
    agent,
    input: 'Synthetic private input',
    status: 'queued',
    version: 0,
    idempotencyKey: 'synthetic-key-1234',
    requestFingerprint: 'a'.repeat(64),
  });
const env = { ...process.env };
afterEach(() => {
  jest.restoreAllMocks();
  for (const key of ['NODE_ENV', 'AI_PROVIDER']) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
});
const fixture = (
  chat: AIProvider['chat'] = async () => ({
    value: 'Simulated draft',
    provider: 'demo',
    simulation: true,
    label: 'Simulation: no model',
  }),
  providerId: 'demo' | 'ollama' = 'demo',
) => {
  let state = initial();
  const authority = jest
    .spyOn(permission, 'authorizeRunDraft')
    .mockImplementation(
      async () =>
        ({ allowed: true, run: state, task: { _id: id }, agent: {}, project: null }) as never,
    );
  const denied = jest.spyOn(audit, 'recordRunDenial').mockResolvedValue({} as never);
  const claim = jest
    .spyOn(runs, 'claimRun')
    .mockImplementation(
      async (
        _owner,
        _id,
        _version,
        workMs = 30000,
        _now = new Date(),
        mode = null,
        _includeProject = false,
        workflow = 'draft',
      ) => {
        state = new Run({
          ...state.toObject(),
          status: 'running',
          version: 1,
          attemptId: 'test-attempt',
          workDeadline: new Date(Date.now() + workMs),
          leaseExpiresAt: new Date(Date.now() + workMs + 5000),
          executionMode: mode,
          workflow,
          context: {
            schemaVersion: 1,
            untrusted: true,
            sources: [
              {
                kind: 'task',
                id,
                updatedAt: '2026-01-01T00:00:00.000Z',
                title: 'Synthetic task',
                description: '',
                ...(workflow === 'chief-of-staff' ? { priority: 'medium', status: 'todo' } : {}),
              },
            ],
          },
        });
        return state;
      },
    );
  const complete = jest
    .spyOn(runs, 'completeRun')
    .mockImplementation((_owner, _id, _version, _attempt, result) => {
      state = new Run({ ...state.toObject(), status: 'awaiting-approval', version: 2, result });
      return Promise.resolve(state) as never;
    });
  const fail = jest
    .spyOn(runs, 'failRun')
    .mockImplementation((_owner, _id, _version, _from, _attempt, reason) => {
      if (state.version !== _version || state.status !== _from || state.attemptId !== _attempt)
        return Promise.resolve(null) as never;
      state = new Run({ ...state.toObject(), status: 'failed', version: 2, failureReason: reason });
      return Promise.resolve(state) as never;
    });
  jest.spyOn(runs, 'getOwnedRun').mockImplementation(() => Promise.resolve(state) as never);
  const modelCall = jest.fn(chat);
  const provider: AIProvider = {
    id: providerId,
    capabilities: { chat: true, structuredOutput: true, embeddings: false },
    chat: modelCall,
    structuredOutput: jest.fn(),
    embed: jest.fn(),
  };
  const resolve = jest.fn(() => provider);
  const executor = createRunExecutor({ providerForMode: resolve });
  return {
    authority,
    denied,
    claim,
    complete,
    fail,
    modelCall,
    resolve,
    executor,
    state: () => state,
  };
};
it('commits an audited claim and rechecks authority before a draft-only call and persistence', async () => {
  const f = fixture();
  const result = await f.executor.execute(owner, id, 'demo');
  expect(result.status).toBe('awaiting-approval');
  expect(result.result).toMatchObject({ text: 'Simulated draft', simulation: true });
  expect(f.authority).toHaveBeenCalledTimes(3);
  expect(f.claim).toHaveBeenCalledWith(
    owner,
    id,
    0,
    30000,
    expect.any(Date),
    'demo',
    false,
    'draft',
  );
  expect(f.claim.mock.invocationCallOrder[0]).toBeLessThan(f.modelCall.mock.invocationCallOrder[0]);
  expect(f.modelCall.mock.calls[0][0]).toEqual([
    expect.objectContaining({ role: 'system' }),
    {
      role: 'user',
      content: JSON.stringify({
        request: 'Synthetic private input',
        untrustedContext: f.state().context,
      }),
    },
  ]);
  expect(f.fail).not.toHaveBeenCalled();
});
it('requires explicit mode and never uses supplied capabilities/context', async () => {
  const f = fixture();
  await expect(f.executor.execute(owner, id, undefined)).rejects.toMatchObject({ status: 400 });
  expect(f.denied).toHaveBeenCalled();
  expect(f.resolve).not.toHaveBeenCalled();
  expect(f.claim).not.toHaveBeenCalled();
});
it('fails closed before model invocation when current permissions are denied', async () => {
  const f = fixture();
  f.authority.mockResolvedValue({ allowed: false, reason: 'missing-permission' });
  await expect(f.executor.execute(owner, id, 'demo')).rejects.toMatchObject({ status: 403 });
  expect(f.modelCall).not.toHaveBeenCalled();
  expect(f.claim).not.toHaveBeenCalled();
});
it('fails closed before a model call when the standalone audit write fails', async () => {
  const f = fixture();
  f.authority.mockResolvedValue({ allowed: false, reason: 'missing-permission' });
  f.denied.mockRejectedValue(new audit.AuditUnavailableError());
  await expect(f.executor.execute(owner, id, 'demo')).rejects.toThrow('Audit recording');
  expect(f.modelCall).not.toHaveBeenCalled();
});
it('fails closed before a model call when atomic claim/audit persistence fails', async () => {
  const f = fixture();
  f.claim.mockRejectedValue(new Error('DB audit failure'));
  await expect(f.executor.execute(owner, id, 'demo')).rejects.toMatchObject({ status: 503 });
  expect(f.modelCall).not.toHaveBeenCalled();
  expect(f.complete).not.toHaveBeenCalled();
});
it.each([2, 3])(
  'rejects permissions revoked at check %s without accepting a result',
  async (check) => {
    const f = fixture();
    let calls = 0;
    f.authority.mockImplementation(async () =>
      ++calls === check
        ? { allowed: false, reason: 'missing-permission' }
        : ({ allowed: true, run: f.state(), task: { _id: id }, agent: {}, project: null } as never),
    );
    await expect(f.executor.execute(owner, id, 'demo')).rejects.toMatchObject({ status: 403 });
    expect(f.complete).not.toHaveBeenCalled();
    expect(f.fail).toHaveBeenCalledWith(
      owner,
      id,
      1,
      'running',
      'test-attempt',
      'permission-denied',
    );
    expect(f.modelCall).toHaveBeenCalledTimes(check === 2 ? 0 : 1);
  },
);
it('blocks local inference in production before resolving a provider', async () => {
  const f = fixture();
  process.env.NODE_ENV = 'production';
  await expect(f.executor.execute(owner, id, 'local')).rejects.toMatchObject({ status: 503 });
  expect(f.resolve).not.toHaveBeenCalled();
  expect(f.claim).not.toHaveBeenCalled();
});
it('repeated denied execution never changes an active attempt or kills its model call', async () => {
  let finish!: (value: Awaited<ReturnType<AIProvider['chat']>>) => void;
  const f = fixture(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = f.executor.execute(owner, id, 'demo');
  while (!f.modelCall.mock.calls.length) await Promise.resolve();
  await expect(f.executor.execute(owner, id, 'demo')).rejects.toMatchObject({ status: 409 });
  expect(f.fail).not.toHaveBeenCalled();
  expect(f.state().version).toBe(1);
  finish({ value: 'Simulated draft', provider: 'demo', simulation: true, label: 'Simulation' });
  expect((await pending).status).toBe('awaiting-approval');
});
it('cancellation fences the persisted attempt before aborting local work', async () => {
  const f = fixture(
    (_messages, options) =>
      new Promise((_resolve, reject) =>
        options!.signal!.addEventListener('abort', () => reject(new Error('aborted')), {
          once: true,
        }),
      ),
  );
  const pending = expect(f.executor.execute(owner, id, 'demo')).rejects.toMatchObject({
    status: 503,
  });
  while (!f.modelCall.mock.calls.length) await Promise.resolve();
  expect((await f.executor.cancel(owner, id)).status).toBe('failed');
  await pending;
  expect(f.complete).not.toHaveBeenCalled();
  expect(f.fail).toHaveBeenCalledWith(owner, id, 1, 'running', 'test-attempt', 'cancelled');
});
it('HTTP interruption retires the attempt and never persists later output', async () => {
  const caller = new AbortController();
  const f = fixture(
    (_messages, options) =>
      new Promise((_resolve, reject) =>
        options!.signal!.addEventListener('abort', () => reject(new Error('aborted')), {
          once: true,
        }),
      ),
  );
  const pending = expect(
    f.executor.execute(owner, id, 'demo', caller.signal),
  ).rejects.toMatchObject({ status: 503 });
  while (!f.modelCall.mock.calls.length) await Promise.resolve();
  caller.abort();
  await pending;
  expect(f.fail).toHaveBeenCalledWith(owner, id, 1, 'running', 'test-attempt', 'interrupted');
  expect(f.complete).not.toHaveBeenCalled();
});

it('routes explicitly selected local drafts through the reused local adapter without simulation', async () => {
  process.env.NODE_ENV = 'development';
  const f = fixture(
    async () => ({
      value: 'Synthetic local draft',
      provider: 'ollama',
      simulation: false,
      label: 'Local fixture; no hosted provider',
    }),
    'ollama',
  );
  const result = await f.executor.execute(owner, id, 'local');
  expect(result.result).toMatchObject({
    provider: 'ollama',
    simulation: false,
    text: 'Synthetic local draft',
  });
  expect(result.executionMode).toBe('local');
  expect(f.claim).toHaveBeenCalledWith(
    owner,
    id,
    0,
    30000,
    expect.any(Date),
    'local',
    false,
    'draft',
  );
});

it('rejects disabled local configuration without claiming work or making network calls', async () => {
  const f = fixture();
  process.env.NODE_ENV = 'development';
  process.env.AI_PROVIDER = 'disabled';
  const network = jest.spyOn(globalThis, 'fetch');
  const executor = createRunExecutor();
  await expect(executor.execute(owner, id, 'local')).rejects.toMatchObject({ status: 503 });
  expect(f.claim).not.toHaveBeenCalled();
  expect(network).not.toHaveBeenCalled();
});

it('bounds an active draft and records expiry without accepting partial output', async () => {
  const f = fixture(
    (_messages, options) =>
      new Promise((_resolve, reject) =>
        options!.signal!.addEventListener('abort', () => reject(new Error('expired')), {
          once: true,
        }),
      ),
  );
  const provider: AIProvider = {
    id: 'demo',
    capabilities: { chat: true, structuredOutput: true, embeddings: false },
    chat: f.modelCall,
    structuredOutput: jest.fn(),
    embed: jest.fn(),
  };
  const executor = createRunExecutor({ providerForMode: () => provider, timeoutMs: 10 });
  await expect(executor.execute(owner, id, 'demo')).rejects.toMatchObject({ status: 503 });
  expect(f.complete).not.toHaveBeenCalled();
  expect(f.state().failureReason).toBe('expired');
});

it('awaits safe denial audit after a cancellation CAS miss without retiring active work', async () => {
  let finish!: (value: Awaited<ReturnType<AIProvider['chat']>>) => void;
  const f = fixture(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const execution = f.executor.execute(owner, id, 'demo');
  while (!f.modelCall.mock.calls.length) await Promise.resolve();
  const signal = f.modelCall.mock.calls[0][1]!.signal!;
  f.fail.mockResolvedValueOnce(null);
  let acknowledge!: () => void;
  f.denied.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        acknowledge = () => resolve({} as never);
      }),
  );
  let settled = false;
  const cancellation = f.executor.cancel(owner, id).then(
    (value) => {
      settled = true;
      return value;
    },
    (error: unknown) => {
      settled = true;
      throw error;
    },
  );
  const rejected = expect(cancellation).rejects.toMatchObject({
    status: 409,
    message: 'Run state changed before cancellation',
  });
  while (!f.denied.mock.calls.length) await Promise.resolve();
  expect(settled).toBe(false);
  expect(f.denied).toHaveBeenCalledWith(owner, id, 'state-conflict', 'cancel');
  expect(f.fail).toHaveBeenCalledTimes(1);
  expect(f.fail).toHaveBeenCalledWith(owner, id, 1, 'running', 'test-attempt', 'cancelled');
  expect(signal.aborted).toBe(false);
  expect(f.state().status).toBe('running');
  expect(f.state().version).toBe(1);
  expect(f.complete).not.toHaveBeenCalled();
  acknowledge();
  await rejected;
  expect(signal.aborted).toBe(false);
  finish({ value: 'Simulated draft', provider: 'demo', simulation: true, label: 'Simulation' });
  expect((await execution).status).toBe('awaiting-approval');
});

it('fails a cancellation CAS miss safely when denial audit is unavailable', async () => {
  let finish!: (value: Awaited<ReturnType<AIProvider['chat']>>) => void;
  const f = fixture(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const execution = f.executor.execute(owner, id, 'demo');
  while (!f.modelCall.mock.calls.length) await Promise.resolve();
  const signal = f.modelCall.mock.calls[0][1]!.signal!;
  f.fail.mockResolvedValueOnce(null);
  f.denied.mockRejectedValueOnce(new audit.AuditUnavailableError());
  await expect(f.executor.cancel(owner, id)).rejects.toBeInstanceOf(audit.AuditUnavailableError);
  expect(f.denied).toHaveBeenCalledWith(owner, id, 'state-conflict', 'cancel');
  expect(f.fail).toHaveBeenCalledTimes(1);
  expect(signal.aborted).toBe(false);
  expect(f.state().status).toBe('running');
  expect(f.state().version).toBe(1);
  expect(f.complete).not.toHaveBeenCalled();
  finish({ value: 'Simulated draft', provider: 'demo', simulation: true, label: 'Simulation' });
  expect((await execution).status).toBe('awaiting-approval');
});

it('records timer-driven expiry even when the wall clock remains before the work deadline', async () => {
  const beforeDeadline = Date.now();
  jest.spyOn(Date, 'now').mockReturnValue(beforeDeadline);
  const f = fixture(
    (_messages, options) =>
      new Promise((_resolve, reject) =>
        options!.signal!.addEventListener('abort', () => reject(new Error('expired')), {
          once: true,
        }),
      ),
  );
  const provider: AIProvider = {
    id: 'demo',
    capabilities: { chat: true, structuredOutput: true, embeddings: false },
    chat: f.modelCall,
    structuredOutput: jest.fn(),
    embed: jest.fn(),
  };
  const executor = createRunExecutor({ providerForMode: () => provider, timeoutMs: 10 });
  await expect(executor.execute(owner, id, 'demo')).rejects.toMatchObject({ status: 503 });
  expect(Date.now()).toBeLessThan(f.state().workDeadline!.getTime());
  expect(f.modelCall).toHaveBeenCalledTimes(1);
  expect(f.modelCall.mock.calls[0][1]!.signal!.aborted).toBe(true);
  expect(f.complete).not.toHaveBeenCalled();
  expect(f.state().failureReason).toBe('expired');
});
it.each([null, 'automatic', {}, [], 0, true])(
  'audits invalid workflow %s before claims or providers',
  async (workflow) => {
    const f = fixture();
    await expect(
      f.executor.execute(owner, id, 'demo', undefined, false, workflow),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.denied).toHaveBeenCalledWith(owner, id, 'invalid-workflow', 'execute');
    expect(f.claim).not.toHaveBeenCalled();
    expect(f.modelCall).not.toHaveBeenCalled();
  },
);
it('requires structured capability before claiming Chief of Staff work', async () => {
  const f = fixture();
  const provider: AIProvider = {
    id: 'demo',
    capabilities: { chat: true, structuredOutput: false, embeddings: false },
    chat: f.modelCall,
    structuredOutput: jest.fn(),
    embed: jest.fn(),
  };
  f.resolve.mockReturnValue(provider);
  await expect(
    f.executor.execute(owner, id, 'demo', undefined, false, 'chief-of-staff'),
  ).rejects.toMatchObject({ status: 503 });
  expect(f.claim).not.toHaveBeenCalled();
  expect(provider.chat).not.toHaveBeenCalled();
  expect(provider.structuredOutput).not.toHaveBeenCalled();
});
it('stores a separately reviewable Chief of Staff simulation proposal without chat/tool/task writes', async () => {
  const f = fixture();
  const structured = jest.fn().mockResolvedValue({
    value: { summary: 'Canned', simulated: true },
    provider: 'demo',
    simulation: true,
    label: 'Simulation: no model',
  });
  const provider: AIProvider = {
    id: 'demo',
    capabilities: { chat: true, structuredOutput: true, embeddings: false },
    chat: f.modelCall,
    structuredOutput: structured,
    embed: jest.fn(),
  };
  f.resolve.mockReturnValue(provider);
  const result = await f.executor.execute(owner, id, 'demo', undefined, false, 'chief-of-staff');
  expect(result.status).toBe('awaiting-approval');
  expect(result.workflow).toBe('chief-of-staff');
  expect(result.result).toMatchObject({
    proposal: { taskId: id, agentId: null, priority: 'medium' },
    simulation: true,
    provider: 'demo',
  });
  expect(result.result).toMatchObject({
    text: expect.stringContaining('no task changes are applied'),
  });
  expect(structured).toHaveBeenCalledTimes(1);
  expect(f.modelCall).not.toHaveBeenCalled();
  expect(f.complete).toHaveBeenCalledTimes(1);
  expect(f.claim.mock.calls[0][7]).toBe('chief-of-staff');
});
