import { createHash } from 'node:crypto';
import { Run } from '../../models/runModel';
import { Task } from '../../models/taskModel';
import { Agent } from '../../models/agentModel';
import {
  claimRun,
  createRunIndexGuard,
  completeRun,
  createOwnedRun,
  failRun,
  recoverExpiredRun,
  reviewRun,
} from './index';
const owner = '507f1f77bcf86cd799439011';
const id = '507f1f77bcf86cd799439012';
const agent = '507f1f77bcf86cd799439013';
afterEach(() => jest.restoreAllMocks());
it('uses owner/status/version/attempt/deadline fencing for completion and recovery', async () => {
  const update = jest
    .spyOn(Run, 'findOneAndUpdate')
    .mockReturnValue(Promise.resolve(null) as never);
  const now = new Date();
  await completeRun(owner, id, 1, 'attempt', { summary: 'Draft' }, now);
  expect(update.mock.calls[0][0]).toEqual({
    _id: id,
    owner,
    status: 'running',
    version: 1,
    attemptId: 'attempt',
    workDeadline: { $gt: now },
    leaseExpiresAt: { $gt: now },
  });
  await recoverExpiredRun(owner, id, 1, 'attempt', now);
  expect(update.mock.calls[1][0]).toMatchObject({
    _id: id,
    owner,
    status: 'running',
    version: 1,
    attemptId: 'attempt',
    $or: [{ workDeadline: { $lte: now } }, { leaseExpiresAt: { $lte: now } }],
  });
});
it.each([0, -1, 120001, NaN, 0.5])(
  'rejects invalid claim duration %s before DB work',
  async (duration) => {
    const find = jest.spyOn(Run, 'findOne');
    await expect(claimRun(owner, id, 0, duration)).rejects.toThrow('Invalid run deadline');
    expect(find).not.toHaveBeenCalled();
  },
);
it('rechecks assigned task and active agent before atomically claiming queued work', async () => {
  jest.spyOn(Run, 'findOne').mockReturnValue(Promise.resolve({ task: id, agent }) as never);
  const task = jest.spyOn(Task, 'exists').mockReturnValue(Promise.resolve({ _id: id }) as never);
  const ownedAgent = jest
    .spyOn(Agent, 'exists')
    .mockReturnValue(Promise.resolve({ _id: agent }) as never);
  const update = jest
    .spyOn(Run, 'findOneAndUpdate')
    .mockReturnValue(Promise.resolve(null) as never);
  await claimRun(owner, id, 0, 100);
  expect(task).toHaveBeenCalledWith({
    _id: id,
    owner,
    assigneeType: 'agent',
    assigneeAgent: agent,
  });
  expect(ownedAgent).toHaveBeenCalledWith({ _id: agent, owner, status: 'active' });
  expect(update.mock.calls[0][0]).toEqual({ _id: id, owner, status: 'queued', version: 0 });
});
it('rejects invalid result/decision/attempt/version before DB work', () => {
  const update = jest.spyOn(Run, 'findOneAndUpdate');
  expect(() => completeRun(owner, id, 1, 'attempt', null)).toThrow('Invalid run result');
  expect(() => completeRun(owner, id, 1, 'attempt', { text: 'x'.repeat(65536) })).toThrow(
    'Invalid run result',
  );
  expect(() => reviewRun(owner, id, 1, 'running' as 'approved')).toThrow('Invalid run decision');
  expect(() => failRun(owner, id, 1, 'running', null, 'interrupted')).toThrow(
    'Invalid run attempt',
  );
  expect(() => reviewRun(owner, id, -1, 'approved')).toThrow('Invalid run version');
  expect(update).not.toHaveBeenCalled();
});
it('handles a unique-key race by reading only the same owner key and preserving identical input', async () => {
  jest.spyOn(Run.collection, 'createIndex').mockResolvedValue('owner_1_idempotencyKey_1');
  const input = {
    taskId: id,
    agentId: agent,
    input: 'Synthetic',
    idempotencyKey: 'synthetic-key-1234',
  };
  const requestFingerprint = createHash('sha256')
    .update(JSON.stringify([id, agent, input.input]))
    .digest('hex');
  const winner = { _id: id, requestFingerprint };
  const find = jest
    .spyOn(Run, 'findOne')
    .mockReturnValueOnce(Promise.resolve(null) as never)
    .mockReturnValueOnce(Promise.resolve(winner) as never);
  jest.spyOn(Task, 'exists').mockReturnValue(Promise.resolve({ _id: id }) as never);
  jest.spyOn(Agent, 'exists').mockReturnValue(Promise.resolve({ _id: agent }) as never);
  jest.spyOn(Run, 'create').mockRejectedValue({ code: 11000 } as never);
  expect(await createOwnedRun(owner, input)).toEqual({ run: winner, created: false });
  expect(find).toHaveBeenNthCalledWith(2, { owner, idempotencyKey: input.idempotencyKey });
});

it('does no lookup or insert until concurrent creation waits for the unique index acknowledgement', async () => {
  let release!: (name: string) => void;
  const index = jest.spyOn(Run.collection, 'createIndex').mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const input = {
    taskId: id,
    agentId: agent,
    input: 'Synthetic',
    idempotencyKey: 'synthetic-key-1234',
  };
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([id, agent, input.input]))
    .digest('hex');
  const find = jest
    .spyOn(Run, 'findOne')
    .mockReturnValue(Promise.resolve({ _id: id, requestFingerprint: fingerprint }) as never);
  const insert = jest.spyOn(Run, 'create');
  const calls = [createOwnedRun(owner, input), createOwnedRun(owner, input)];
  await Promise.resolve();
  expect(index).toHaveBeenCalledTimes(1);
  expect(index).toHaveBeenCalledWith(
    { owner: 1, idempotencyKey: 1 },
    { unique: true, maxTimeMS: 5000 },
  );
  expect(find).not.toHaveBeenCalled();
  expect(insert).not.toHaveBeenCalled();
  release('owner_1_idempotencyKey_1');
  expect((await Promise.all(calls)).map((result) => result.created)).toEqual([false, false]);
  expect(find).toHaveBeenCalledTimes(2);
});

it('fails closed without run lookup/write when the index cannot be established', async () => {
  jest.spyOn(Run.collection, 'createIndex').mockRejectedValue(new Error('private index failure'));
  const find = jest.spyOn(Run, 'findOne');
  const insert = jest.spyOn(Run, 'create');
  await expect(
    createOwnedRun(owner, {
      taskId: id,
      agentId: agent,
      input: 'Synthetic',
      idempotencyKey: 'synthetic-key-1234',
    }),
  ).rejects.toMatchObject({ status: 503, message: 'Run creation is temporarily unavailable' });
  expect(find).not.toHaveBeenCalled();
  expect(insert).not.toHaveBeenCalled();
});

it('bounds index waits and coalesces stalled work until the driver settles without late rejection leaks', async () => {
  jest.useFakeTimers();
  let rejectLate!: (error: Error) => void;
  const ensure = jest.fn(
    () =>
      new Promise((_resolve, reject) => {
        rejectLate = reject;
      }),
  );
  const gate = createRunIndexGuard(ensure, 10);
  try {
    const first = expect(gate()).rejects.toMatchObject({ status: 503 });
    await jest.advanceTimersByTimeAsync(10);
    await first;
    const second = expect(gate()).rejects.toMatchObject({ status: 503 });
    await jest.advanceTimersByTimeAsync(10);
    await second;
    expect(ensure).toHaveBeenCalledTimes(1);
    rejectLate(new Error('late failure'));
    await jest.advanceTimersByTimeAsync(0);
    ensure.mockImplementation(async () => 'index acknowledged');
    await gate();
    expect(ensure).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});
it.each(['automatic', null, 42])(
  'rejects unsupported claimed workflow %s before reading records',
  async (workflow) => {
    const find = jest.spyOn(Run, 'findOne');
    await expect(
      claimRun(owner, id, 0, 30000, new Date(), 'demo', false, workflow as never),
    ).rejects.toThrow('Invalid run workflow');
    expect(find).not.toHaveBeenCalled();
  },
);
it('requires explicit provider mode for Chief of Staff claims', async () => {
  const find = jest.spyOn(Run, 'findOne');
  await expect(
    claimRun(owner, id, 0, 30000, new Date(), null, false, 'chief-of-staff'),
  ).rejects.toThrow('Invalid run workflow');
  expect(find).not.toHaveBeenCalled();
});
