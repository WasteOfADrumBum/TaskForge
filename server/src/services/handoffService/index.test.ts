import { Run, digestRunResult } from '../../models/runModel';
import { Task } from '../../models/taskModel';
import { Agent } from '../../models/agentModel';
import { recordRunDenial } from '../auditService';
import { readApprovedChain } from './authority';
import { createOwnedHandoff, listOwnedHandoffs } from './index';
jest.mock('../runService', () => ({ ensureRunIndex: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../auditService', () => ({ recordRunDenial: jest.fn().mockResolvedValue(undefined) }));
jest.mock('./authority', () => ({ readApprovedChain: jest.fn() }));
const owner = '507f1f77bcf86cd799439011';
const parentId = '507f1f77bcf86cd799439012';
const taskId = '507f1f77bcf86cd799439013';
const sourceAgent = '507f1f77bcf86cd799439014';
const agentId = '507f1f77bcf86cd799439015';
const result = { text: 'Approved draft text', secret: 'EXCLUDED_FIELD' };
const digest = digestRunResult(result)!;
const parent = {
  _id: parentId,
  agent: sourceAgent,
  status: 'approved',
  version: 3,
  result,
  review: { decision: 'approved', resultDigest: digest },
  updatedAt: new Date('2026-01-01Z'),
};
const input = {
  taskId,
  agentId,
  input: 'Next explicit work',
  version: 3,
  resultDigest: digest,
  idempotencyKey: 'stable-handoff-key',
};
let find: jest.SpyInstance;
let create: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  find = jest.spyOn(Run, 'findOne').mockResolvedValue(null);
  find.mockResolvedValueOnce(null).mockResolvedValueOnce(parent);
  create = jest.spyOn(Run, 'create').mockResolvedValue({ _id: taskId } as never);
  jest
    .spyOn(Agent, 'findOne')
    .mockResolvedValue({ _id: agentId, permissions: ['task.read', 'artifact.draft'] } as never);
  jest.spyOn(Task, 'findOne').mockResolvedValue({
    _id: taskId,
    title: 'Target task',
    description: 'Target notes',
    updatedAt: new Date('2026-01-01Z'),
  } as never);
  jest.mocked(readApprovedChain).mockResolvedValue([parent] as never);
});
afterEach(() => jest.restoreAllMocks());
it('creates only queued owner-controlled child metadata and never mutates task or parent', async () => {
  const update = jest.spyOn(Task, 'findOneAndUpdate');
  const parentUpdate = jest.spyOn(Run, 'findOneAndUpdate');
  expect(await createOwnedHandoff(owner, parentId, input)).toEqual({
    run: { _id: taskId },
    created: true,
  });
  expect(Agent.findOne).toHaveBeenCalledWith({ _id: agentId, owner, status: 'active' });
  expect(Task.findOne).toHaveBeenCalledWith({
    _id: taskId,
    owner,
    assigneeType: 'agent',
    assigneeAgent: agentId,
  });
  expect(create.mock.calls[0][0]).toMatchObject({
    owner,
    task: taskId,
    agent: agentId,
    status: 'queued',
    version: 0,
    result: null,
    context: {},
    handoff: {
      parent: parentId,
      ancestors: [parentId],
      sourceVersion: 3,
      sourceResultDigest: digest,
    },
  });
  expect(create.mock.calls[0][0].auditEvents[0]).toMatchObject({
    kind: 'created',
    parentRun: parentId,
    sourceResultDigest: digest,
  });
  expect(JSON.stringify(create.mock.calls[0][0].auditEvents)).not.toContain('Approved draft text');
  expect(update).not.toHaveBeenCalled();
  expect(parentUpdate).not.toHaveBeenCalled();
});
it.each(['queued', 'running', 'awaiting-approval', 'rejected', 'failed'])(
  'denies unapproved %s source before target lookup',
  async (status) => {
    find
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...parent, status });
    await expect(createOwnedHandoff(owner, parentId, input)).rejects.toMatchObject({ status: 409 });
    expect(Agent.findOne).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(recordRunDenial).toHaveBeenCalledWith(owner, parentId, 'state-conflict', 'handoff');
  },
);
it.each([{ version: 2 }, { resultDigest: 'b'.repeat(64) }])(
  'rejects stale reviewed version/digest %s',
  async (extra) => {
    await expect(createOwnedHandoff(owner, parentId, { ...input, ...extra })).rejects.toMatchObject(
      { status: 409 },
    );
    expect(create).not.toHaveBeenCalled();
  },
);
it('hides a foreign source without reading target records', async () => {
  find.mockReset().mockResolvedValue(null);
  await expect(createOwnedHandoff(owner, parentId, input)).rejects.toMatchObject({ status: 404 });
  expect(find).toHaveBeenCalledWith({ _id: parentId, owner });
  expect(Agent.findOne).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
});
it('rejects max-depth lineage and repeating ancestor agents before target lookup', async () => {
  find
    .mockReset()
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ ...parent, handoff: { ancestors: [parentId, taskId, sourceAgent] } });
  await expect(createOwnedHandoff(owner, parentId, input)).rejects.toMatchObject({ status: 400 });
  expect(create).not.toHaveBeenCalled();
  find.mockReset().mockResolvedValueOnce(null).mockResolvedValueOnce(parent);
  jest.mocked(readApprovedChain).mockResolvedValue([{ ...parent, agent: agentId }] as never);
  await expect(createOwnedHandoff(owner, parentId, input)).rejects.toMatchObject({ status: 400 });
  expect(Agent.findOne).not.toHaveBeenCalled();
});
it.each([[], ['task.read'], ['artifact.draft'], ['task.read', 'artifact.draft', 'shell.execute']])(
  'rejects missing or unknown permissions %s',
  async (...permissions) => {
    jest.mocked(Agent.findOne).mockResolvedValue({ _id: agentId, permissions } as never);
    await expect(createOwnedHandoff(owner, parentId, input)).rejects.toMatchObject({ status: 403 });
    expect(Task.findOne).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  },
);
it('denies a paused/foreign target or unassigned task without insertion', async () => {
  jest.mocked(Agent.findOne).mockResolvedValue(null);
  await expect(createOwnedHandoff(owner, parentId, input)).rejects.toMatchObject({ status: 400 });
  expect(create).not.toHaveBeenCalled();
});
it('rejects oversized approved output before insertion', async () => {
  const large = { ...parent, review: { ...parent.review }, result: { text: '😀'.repeat(5000) } };
  const largeDigest = digestRunResult(large.result)!;
  large.review.resultDigest = largeDigest;
  find.mockReset().mockResolvedValueOnce(null).mockResolvedValueOnce(large);
  jest.mocked(readApprovedChain).mockResolvedValue([large] as never);
  await expect(
    createOwnedHandoff(owner, parentId, { ...input, resultDigest: largeDigest }),
  ).rejects.toMatchObject({ reason: 'context-too-large' });
  expect(create).not.toHaveBeenCalled();
});
it('fails closed when durable denial audit is unavailable', async () => {
  find.mockReset().mockResolvedValue(null);
  jest.mocked(recordRunDenial).mockRejectedValueOnce(new Error('Audit unavailable'));
  await expect(createOwnedHandoff(owner, parentId, input)).rejects.toThrow('Audit unavailable');
  expect(create).not.toHaveBeenCalled();
});
it('owner-scopes and bounds direct child history', async () => {
  jest.spyOn(Run, 'exists').mockResolvedValue({ _id: parentId } as never);
  const limit = jest.fn().mockResolvedValue([]);
  const sort = jest.fn().mockReturnValue({ limit });
  const query = jest.spyOn(Run, 'find').mockReturnValue({ sort } as never);
  expect(await listOwnedHandoffs(owner, parentId)).toEqual([]);
  expect(query).toHaveBeenCalledWith({ owner, 'handoff.parent': parentId });
  expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
  expect(limit).toHaveBeenCalledWith(100);
});
it('rejects unavailable ancestry before target lookups', async () => {
  jest.mocked(readApprovedChain).mockResolvedValue(null);
  await expect(createOwnedHandoff(owner, parentId, input)).rejects.toMatchObject({ status: 403 });
  expect(Agent.findOne).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
});
it('rejects an unassigned or foreign task without insertion', async () => {
  jest.mocked(Task.findOne).mockResolvedValue(null);
  await expect(createOwnedHandoff(owner, parentId, input)).rejects.toMatchObject({ status: 400 });
  expect(create).not.toHaveBeenCalled();
});
it('reuses an identical owner key but rejects changed source/input without new insertion', async () => {
  await createOwnedHandoff(owner, parentId, input);
  const fingerprint = create.mock.calls[0][0].requestFingerprint;
  create.mockClear();
  const winner = { _id: taskId, requestFingerprint: fingerprint };
  find.mockReset().mockResolvedValue(winner);
  expect(await createOwnedHandoff(owner, parentId, input)).toEqual({ run: winner, created: false });
  await expect(
    createOwnedHandoff(owner, parentId, { ...input, input: 'Changed work' }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(createOwnedHandoff(owner, parentId, { ...input, version: 4 })).rejects.toMatchObject(
    { status: 409 },
  );
  expect(create).not.toHaveBeenCalled();
});
it('recovers a concurrent duplicate-key winner only for the same owner and exact fingerprint', async () => {
  await createOwnedHandoff(owner, parentId, input);
  const winner = { _id: taskId, requestFingerprint: create.mock.calls[0][0].requestFingerprint };
  find
    .mockReset()
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(parent)
    .mockResolvedValueOnce(winner);
  create.mockClear().mockRejectedValueOnce({ code: 11000 });
  expect(await createOwnedHandoff(owner, parentId, input)).toEqual({ run: winner, created: false });
  expect(find).toHaveBeenLastCalledWith({ owner, idempotencyKey: input.idempotencyKey });
  expect(create).toHaveBeenCalledTimes(1);
});
