import { createHash, randomUUID } from 'node:crypto';
import { Run, isBoundedJson, RUN_RESULT_MAX_BYTES } from '../../models/runModel';
import { Task } from '../../models/taskModel';
import { Agent } from '../../models/agentModel';

export class RunInputError extends Error {
  constructor(
    public readonly status: 400 | 409 | 503,
    message: string,
  ) {
    super(message);
  }
}
// Lazy and scoped to this new collection. A Mongo acknowledgement of this exact
// unique index is required even when Mongoose autoIndex is disabled. No import/startup writes.
export const createRunIndexGuard = (ensureIndex: () => Promise<unknown>, timeoutMs = 5000) => {
  let active: Promise<unknown> | undefined;
  return async () => {
    if (!active) {
      const operation = Promise.resolve().then(ensureIndex);
      active = operation;
      const release = () => {
        if (active === operation) active = undefined;
      };
      // Hold the single-flight guard until the driver settles, including after a caller timeout.
      void operation.then(release, release);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        active,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Index deadline exceeded')), timeoutMs);
        }),
      ]);
    } catch {
      throw new RunInputError(503, 'Run creation is temporarily unavailable');
    } finally {
      clearTimeout(timer);
    }
  };
};
const ensureRunIndex = createRunIndexGuard(() =>
  Run.collection.createIndex({ owner: 1, idempotencyKey: 1 }, { unique: true, maxTimeMS: 5000 }),
);

const lifecycle = (
  owner: string,
  kind: 'created' | 'claimed' | 'drafted' | 'failed' | 'expired' | 'approved' | 'rejected',
  from: 'queued' | 'running' | 'awaiting-approval' | null,
  to: 'queued' | 'running' | 'awaiting-approval' | 'approved' | 'rejected' | 'failed',
  version: number,
  mode: 'demo' | 'local' | null = null,
  reason:
    'expired' | 'interrupted' | 'cancelled' | 'provider-error' | 'permission-denied' | null = null,
) => ({ id: randomUUID(), at: new Date(), actor: owner, kind, from, to, version, mode, reason });

export interface CreateRunInput {
  taskId: string;
  agentId: string;
  input: string;
  idempotencyKey: string;
}
export const getOwnedRun = (owner: string, id: string) => Run.findOne({ _id: id, owner });
export const listOwnedRuns = (owner: string) =>
  Run.find({ owner }).sort({ createdAt: -1 }).limit(100);

export const createOwnedRun = async (owner: string, input: CreateRunInput) => {
  await ensureRunIndex();
  const taskId = input.taskId.toLowerCase();
  const agentId = input.agentId.toLowerCase();
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([taskId, agentId, input.input]))
    .digest('hex');
  const existing = await Run.findOne({ owner, idempotencyKey: input.idempotencyKey });
  const reuse = (run: NonNullable<typeof existing>) => {
    if (run.requestFingerprint !== fingerprint)
      throw new RunInputError(409, 'Idempotency key already used for different input');
    return { run, created: false };
  };
  if (existing) return reuse(existing);
  if (!(await Task.exists({ _id: taskId, owner, assigneeType: 'agent', assigneeAgent: agentId })))
    throw new RunInputError(400, 'Task must be assigned to this agent');
  if (!(await Agent.exists({ _id: agentId, owner, status: 'active' })))
    throw new RunInputError(400, 'Active agent not found');
  try {
    const run = await Run.create({
      owner,
      task: taskId,
      agent: agentId,
      input: input.input,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: fingerprint,
      context: {},
      result: null,
      status: 'queued',
      version: 0,
      auditEvents: [lifecycle(owner, 'created', null, 'queued', 0)],
    });
    return { run, created: true };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      const winner = await Run.findOne({ owner, idempotencyKey: input.idempotencyKey });
      if (winner) return reuse(winner);
    }
    throw error;
  }
};

const assertVersion = (version: number) => {
  if (!Number.isSafeInteger(version) || version < 0)
    throw new RunInputError(400, 'Invalid run version');
};
const updateOptions = { new: true, runValidators: true, maxTimeMS: 5000 };
export const claimRun = async (
  owner: string,
  id: string,
  version: number,
  workMs = 120000,
  now = new Date(),
  mode: 'demo' | 'local' | null = null,
) => {
  assertVersion(version);
  if (mode !== null && !['demo', 'local'].includes(mode))
    throw new RunInputError(400, 'Invalid execution mode');
  if (!Number.isInteger(workMs) || workMs < 1 || workMs > 120000 || !Number.isFinite(now.getTime()))
    throw new RunInputError(400, 'Invalid run deadline');
  const run = await Run.findOne({ _id: id, owner, status: 'queued', version });
  if (!run) return null;
  if (
    !(await Task.exists({
      _id: run.task,
      owner,
      assigneeType: 'agent',
      assigneeAgent: run.agent,
    })) ||
    !(await Agent.exists({ _id: run.agent, owner, status: 'active' }))
  )
    return null;
  return Run.findOneAndUpdate(
    { _id: id, owner, status: 'queued', version },
    {
      $set: {
        status: 'running',
        executionMode: mode,
        attemptId: randomUUID(),
        workDeadline: new Date(now.getTime() + workMs),
        leaseExpiresAt: new Date(now.getTime() + workMs + 5000),
      },
      $inc: { version: 1 },
      $push: { auditEvents: lifecycle(owner, 'claimed', 'queued', 'running', version + 1, mode) },
    },
    updateOptions,
  );
};

export const completeRun = (
  owner: string,
  id: string,
  version: number,
  attemptId: string,
  result: unknown,
  now = new Date(),
) => {
  assertVersion(version);
  if (!attemptId || result === null || !isBoundedJson(result, RUN_RESULT_MAX_BYTES))
    throw new RunInputError(400, 'Invalid run result');
  return Run.findOneAndUpdate(
    {
      _id: id,
      owner,
      status: 'running',
      version,
      attemptId,
      workDeadline: { $gt: now },
      leaseExpiresAt: { $gt: now },
    },
    {
      $set: {
        status: 'awaiting-approval',
        result: JSON.parse(JSON.stringify(result)),
        attemptId: null,
        workDeadline: null,
        leaseExpiresAt: null,
      },
      $inc: { version: 1 },
      $push: {
        auditEvents: lifecycle(owner, 'drafted', 'running', 'awaiting-approval', version + 1),
      },
    },
    updateOptions,
  );
};

export const failRun = (
  owner: string,
  id: string,
  version: number,
  from: 'queued' | 'running',
  attemptId: string | null,
  reason: 'interrupted' | 'cancelled' | 'provider-error' | 'permission-denied' | 'expired',
) => {
  assertVersion(version);
  if (
    !['queued', 'running'].includes(from) ||
    (from === 'running' && !attemptId) ||
    (from === 'queued' && attemptId !== null)
  )
    throw new RunInputError(400, 'Invalid run attempt');
  return Run.findOneAndUpdate(
    { _id: id, owner, status: from, version, attemptId },
    {
      $set: {
        status: 'failed',
        failureReason: reason,
        attemptId: null,
        workDeadline: null,
        leaseExpiresAt: null,
      },
      $inc: { version: 1 },
      $push: { auditEvents: lifecycle(owner, 'failed', from, 'failed', version + 1, null, reason) },
    },
    updateOptions,
  );
};

export const recoverExpiredRun = (
  owner: string,
  id: string,
  version: number,
  attemptId: string,
  now = new Date(),
) => {
  assertVersion(version);
  if (!attemptId) throw new RunInputError(400, 'Invalid run attempt');
  return Run.findOneAndUpdate(
    {
      _id: id,
      owner,
      status: 'running',
      version,
      attemptId,
      $or: [{ workDeadline: { $lte: now } }, { leaseExpiresAt: { $lte: now } }],
    },
    {
      $set: {
        status: 'failed',
        failureReason: 'expired',
        attemptId: null,
        workDeadline: null,
        leaseExpiresAt: null,
      },
      $inc: { version: 1 },
      $push: {
        auditEvents: lifecycle(owner, 'expired', 'running', 'failed', version + 1, null, 'expired'),
      },
    },
    updateOptions,
  );
};

// Internal state-machine primitive only. No approval route exists before permission/audit gates.
export const reviewRun = (
  owner: string,
  id: string,
  version: number,
  decision: 'approved' | 'rejected',
) => {
  assertVersion(version);
  if (!['approved', 'rejected'].includes(decision))
    throw new RunInputError(400, 'Invalid run decision');
  return Run.findOneAndUpdate(
    { _id: id, owner, status: 'awaiting-approval', version },
    {
      $set: { status: decision },
      $inc: { version: 1 },
      $push: {
        auditEvents: lifecycle(owner, decision, 'awaiting-approval', decision, version + 1),
      },
    },
    updateOptions,
  );
};
