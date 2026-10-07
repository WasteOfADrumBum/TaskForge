import type { HydratedDocument } from 'mongoose';
import { createHash, randomUUID } from 'node:crypto';
import { Run, HANDOFF_MAX_DEPTH, digestRunResult, type RunRecord } from '../../models/runModel';
import { Task } from '../../models/taskModel';
import { Agent, AGENT_PERMISSIONS } from '../../models/agentModel';
import { ensureRunIndex } from '../runService';
import { buildRunContext } from '../contextService';
import { recordRunDenial } from '../auditService';
import { readApprovedChain } from './authority';

export class HandoffError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409 | 503,
    message: string,
  ) {
    super(message);
  }
}
export interface HandoffInput {
  taskId: string;
  agentId: string;
  input: string;
  version: number;
  resultDigest: string;
  idempotencyKey: string;
}
export const createOwnedHandoff = async (owner: string, parentId: string, input: HandoffInput) => {
  await ensureRunIndex();
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify([
        'handoff',
        parentId.toLowerCase(),
        input.version,
        input.resultDigest,
        input.taskId.toLowerCase(),
        input.agentId.toLowerCase(),
        input.input,
      ]),
    )
    .digest('hex');
  const deny = async (
    reason: Parameters<typeof recordRunDenial>[2],
    status: HandoffError['status'],
    message: string,
  ): Promise<never> => {
    await recordRunDenial(owner, parentId, reason, 'handoff');
    throw new HandoffError(status, message);
  };
  const reuse = async (run: HydratedDocument<RunRecord>) => {
    if (run.requestFingerprint !== fingerprint)
      return deny('state-conflict', 409, 'Handoff retry key already used for different input');
    return { run, created: false };
  };
  const existing = await Run.findOne({ owner, idempotencyKey: input.idempotencyKey });
  if (existing) return reuse(existing);
  const parent = await Run.findOne({ _id: parentId, owner });
  if (!parent) return deny('run-not-found', 404, 'Run not found');
  if (
    parent.status !== 'approved' ||
    parent.version !== input.version ||
    digestRunResult(parent.result) !== input.resultDigest ||
    parent.review?.resultDigest !== input.resultDigest
  )
    return deny('state-conflict', 409, 'Refresh the approved parent before creating a handoff');
  if ((parent.handoff?.ancestors.length ?? 0) >= HANDOFF_MAX_DEPTH)
    return deny('handoff-depth', 400, 'Handoff depth limit reached');
  const chain = await readApprovedChain(owner, parentId);
  if (!chain)
    return deny('handoff-source-unavailable', 403, 'Approved handoff source is unavailable');
  if (chain.some((run) => String(run!.agent) === input.agentId.toLowerCase()))
    return deny('handoff-loop', 400, 'An agent cannot repeat in this handoff chain');
  const agent = await Agent.findOne({ _id: input.agentId, owner, status: 'active' });
  if (!agent) return deny('agent-not-active', 400, 'Active target agent not found');
  if (
    !Array.isArray(agent.permissions) ||
    agent.permissions.some((permission) => !AGENT_PERMISSIONS.includes(permission as never))
  )
    return deny('invalid-permission', 403, 'Target permissions are invalid');
  if (
    !['task.read', 'artifact.draft'].every((permission) =>
      new Set<string>(agent.permissions).has(permission),
    )
  )
    return deny('missing-permission', 403, 'Target requires Read tasks and Draft artifacts');
  const task = await Task.findOne({
    _id: input.taskId,
    owner,
    assigneeType: 'agent',
    assigneeAgent: input.agentId,
  });
  if (!task) return deny('task-not-assigned', 400, 'Target task must be assigned to this agent');
  // Size/shape failure occurs before insertion, and again before the later model call.
  buildRunContext(task, null, parent);
  const handoff = {
    parent: parent._id,
    ancestors: chain.map((run) => run!._id),
    sourceVersion: parent.version,
    sourceResultDigest: input.resultDigest,
  };
  try {
    const run = await Run.create({
      owner,
      task: task._id,
      agent: agent._id,
      input: input.input,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: fingerprint,
      handoff,
      context: {},
      result: null,
      status: 'queued',
      version: 0,
      auditEvents: [
        {
          id: randomUUID(),
          at: new Date(),
          actor: owner,
          kind: 'created',
          from: null,
          to: 'queued',
          version: 0,
          mode: null,
          reason: null,
          parentRun: parent._id,
          sourceResultDigest: input.resultDigest,
        },
      ],
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
export const listOwnedHandoffs = async (owner: string, parentId: string) => {
  if (!(await Run.exists({ _id: parentId, owner }))) return null;
  return Run.find({ owner, 'handoff.parent': parentId }).sort({ createdAt: -1 }).limit(100);
};
