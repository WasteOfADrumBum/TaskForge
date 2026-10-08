import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import app from '../src/app';
import { User } from '../src/models/userModel';
import { Task } from '../src/models/taskModel';
import { Agent } from '../src/models/agentModel';
import { Project } from '../src/models/projectModel';
import { Run } from '../src/models/runModel';
import { AuditEvent } from '../src/models/auditEventModel';
import { createRunExecutor } from '../src/services/runService/execution';
import type { AIProvider } from '../src/ai/provider';
const parent = process.env.TEST_MONGO_URI;
if (
  !parent ||
  !new RegExp(
    '^mongodb://(?:127[.]0[.]0[.]1|localhost):[0-9]{1,5}/taskforge_qa_[a-zA-Z0-9_]{8,}$',
  ).test(parent)
)
  throw new Error('Triage tests require fresh loopback QA namespace');
let owner: string;
let stranger: string;
let token: string;
const auth = () => ({ Authorization: 'Bearer ' + token });
beforeAll(async () => {
  await mongoose.connect(parent + '_triage', {
    autoCreate: false,
    autoIndex: false,
    serverSelectionTimeoutMS: 5000,
  });
  const db = mongoose.connection.db;
  if (!db || (await db.listCollections().toArray()).length)
    throw new Error('Refusing pre-existing triage collections');
  for (const model of [User, Task, Agent, Project, Run, AuditEvent]) {
    await model.createCollection();
    await model.createIndexes();
  }
  owner = (await User.create({ email: 'triage-owner@example.test', password: 'synthetic-only' }))
    .id;
  stranger = (await User.create({ email: 'triage-other@example.test', password: 'synthetic-only' }))
    .id;
  token = jwt.sign({ id: owner }, process.env.JWT_SECRET!);
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  // Fresh owner per scenario: roster state never leaks between tests, and no data is reset.
  owner = (
    await User.create({
      email: 'triage-' + randomUUID() + '@example.test',
      password: 'synthetic-only',
    })
  ).id;
  token = jwt.sign({ id: owner }, process.env.JWT_SECRET!);
});
const fixture = async (candidates = true) => {
  const chief = await Agent.create({
    owner,
    name: 'Chief',
    role: 'Chief of Staff',
    permissions: ['task.read', 'artifact.draft', 'project.read'],
  });
  const project = await Project.create({
    owner,
    name: 'Current project',
    description: 'PROJECT_TRIAGE_CONTEXT',
  });
  const task = await Task.create({
    owner,
    title: 'Urgent research task',
    description: 'Research owned project notes',
    priority: 'low',
    project: project.id,
    assigneeType: 'agent',
    assigneeAgent: chief.id,
  });
  const candidate = candidates
    ? await Agent.create({
        owner,
        name: 'Research candidate',
        role: 'Research',
        skills: ['research'],
        description: 'PRIVATE_CANDIDATE_DESCRIPTION',
        permissions: ['task.read', 'artifact.draft'],
      })
    : null;
  if (candidate)
    await Agent.collection.updateOne(
      { _id: candidate._id },
      { $set: { instructions: 'PRIVATE_CANDIDATE_INSTRUCTIONS', secret: 'PRIVATE_KEY' } },
    );
  const foreign = await Agent.create({
    owner: stranger,
    name: 'FOREIGN_CANDIDATE',
    role: 'Research',
    skills: ['research'],
    permissions: ['task.read', 'artifact.draft'],
  });
  const created = await request(app)
    .post('/api/runs')
    .set(auth())
    .set('Idempotency-Key', randomUUID())
    .send({ taskId: task.id, agentId: chief.id, input: 'Propose triage; do not change tasks' });
  expect(created.status).toBe(201);
  return { chief, project, task, candidate, foreign, run: created.body.run };
};
const execute = (id: string, extra: Record<string, unknown> = {}) =>
  request(app)
    .post('/api/runs/' + id + '/execute')
    .set(auth())
    .send({ mode: 'demo', workflow: 'chief-of-staff', ...extra });
const provider = (value: unknown, after?: () => Promise<void>): AIProvider =>
  ({
    id: 'ollama',
    capabilities: { chat: true, structuredOutput: true, embeddings: false },
    chat: jest.fn(),
    embed: jest.fn(),
    structuredOutput: jest.fn(async () => {
      if (after) await after();
      return {
        value,
        provider: 'ollama',
        simulation: false,
        label: 'Synthetic local adapter fixture',
      };
    }),
  }) as unknown as AIProvider;

it('captures a real owned eligible roster and task/project context, produces labelled demo proposal and awaits exact review', async () => {
  const f = await fixture();
  const response = await execute(f.run._id, { includeProject: true });
  expect(response.status).toBe(200);
  const run = response.body.run;
  expect(run.workflow).toBe('chief-of-staff');
  expect(run.status).toBe('awaiting-approval');
  expect(run.result).toMatchObject({
    simulation: true,
    provider: 'demo',
    proposal: { taskId: f.task.id, agentId: f.candidate!.id, priority: 'high' },
  });
  expect(run.result.text).toContain(f.candidate!.id);
  expect(run.result.label).toContain('Rule-based triage simulation');
  expect(run.auditEvents.find((event: { kind: string }) => event.kind === 'claimed').workflow).toBe(
    'chief-of-staff',
  );
  expect(run.context.sources.filter((source: { kind: string }) => source.kind === 'agent')).toEqual(
    [
      expect.objectContaining({
        id: f.candidate!.id,
        name: f.candidate!.name,
        role: 'Research',
        skills: ['research'],
      }),
    ],
  );
  const context = JSON.stringify(run.context);
  for (const marker of [
    'PRIVATE_CANDIDATE_DESCRIPTION',
    'PRIVATE_CANDIDATE_INSTRUCTIONS',
    'PRIVATE_KEY',
    'FOREIGN_CANDIDATE',
  ])
    expect(context).not.toContain(marker);
  expect(context).toContain('PROJECT_TRIAGE_CONTEXT');
  const review = await request(app)
    .post('/api/runs/' + run._id + '/review')
    .set(auth())
    .send({
      decision: 'approved',
      version: run.version,
      resultDigest: run.resultDigest,
      note: 'Accept draft only',
    });
  expect(review.status).toBe(200);
  expect(review.body.run.status).toBe('approved');
  const unchanged = await Task.findById(f.task.id);
  expect(unchanged!.priority).toBe('low');
  expect(String(unchanged!.assigneeAgent)).toBe(f.chief.id);
});
it('zero eligible candidates yields explicit null instead of fabricating an assignment', async () => {
  const f = await fixture(false);
  const response = await execute(f.run._id);
  expect(response.status).toBe(200);
  expect(response.body.run.result.proposal.agentId).toBeNull();
  expect(
    response.body.run.context.sources.filter((source: { kind: string }) => source.kind === 'agent'),
  ).toEqual([]);
});
it('unknown workflow is denied and audited before claim, and legacy draft stays unchanged', async () => {
  const f = await fixture();
  expect((await execute(f.run._id, { workflow: 'future-agent' })).status).toBe(400);
  const before = await Run.findById(f.run._id);
  expect(before!.status).toBe('queued');
  expect(before!.context).toEqual({});
  expect(
    await AuditEvent.countDocuments({ owner, attemptedRun: f.run._id, reason: 'invalid-workflow' }),
  ).toBe(1);
  const draft = await request(app)
    .post('/api/runs/' + f.run._id + '/execute')
    .set(auth())
    .send({ mode: 'demo' });
  expect(draft.status).toBe(200);
  expect(draft.body.run.workflow).toBe('draft');
  expect(draft.body.run.result.proposal).toBeUndefined();
  expect(
    draft.body.run.context.sources.some((source: { kind: string }) => source.kind === 'agent'),
  ).toBe(false);
});
it('project notes still require persisted project permission', async () => {
  const f = await fixture();
  await Agent.updateOne(
    { _id: f.chief.id },
    { $set: { permissions: ['task.read', 'artifact.draft'] } },
  );
  expect((await execute(f.run._id, { includeProject: true })).status).toBe(403);
  expect((await Run.findById(f.run._id))!.status).toBe('queued');
});
it('runtime invalid/foreign model proposal fails closed with no task changes or result', async () => {
  const f = await fixture();
  const bad = {
    summary: 'PRIVATE_BAD_OUTPUT',
    proposal: {
      taskId: f.task.id,
      agentId: f.foreign.id,
      priority: 'high',
      reason: 'Foreign target',
    },
  };
  const executor = createRunExecutor({ providerForMode: () => provider(bad) });
  await expect(
    executor.execute(owner, f.run._id, 'local', undefined, false, 'chief-of-staff'),
  ).rejects.toMatchObject({ status: 503 });
  const run = await Run.findById(f.run._id);
  expect(run!.status).toBe('failed');
  expect(run!.result).toBeNull();
  expect(JSON.stringify(run!.auditEvents)).not.toContain('PRIVATE_BAD_OUTPUT');
  expect((await Task.findById(f.task.id))!.priority).toBe('low');
});
it('captured eligible candidate revoked during model call prevents proposal persistence', async () => {
  const f = await fixture();
  const value = {
    summary: 'Valid as-of suggestion',
    proposal: {
      taskId: f.task.id,
      agentId: f.candidate!.id,
      priority: 'medium',
      reason: 'Captured candidate',
    },
  };
  const executor = createRunExecutor({
    providerForMode: () =>
      provider(value, async () => {
        await Agent.updateOne({ _id: f.candidate!.id }, { $set: { status: 'paused' } });
      }),
  });
  await expect(
    executor.execute(owner, f.run._id, 'local', undefined, false, 'chief-of-staff'),
  ).rejects.toMatchObject({ status: 403 });
  const run = await Run.findById(f.run._id);
  expect(run!.status).toBe('failed');
  expect(run!.failureReason).toBe('permission-denied');
  expect(run!.result).toBeNull();
});
it('workflow is immutable after audited claim through ordinary lifecycle updates', async () => {
  const f = await fixture();
  const response = await execute(f.run._id);
  const run = response.body.run;
  await expect(
    Run.findOneAndUpdate(
      { _id: run._id, owner, status: 'awaiting-approval', version: run.version },
      {
        $set: { status: 'approved', workflow: 'draft' },
        $inc: { version: 1 },
        $push: {
          auditEvents: {
            id: randomUUID(),
            at: new Date(),
            actor: owner,
            kind: 'approved',
            from: 'awaiting-approval',
            to: 'approved',
            version: run.version + 1,
            mode: 'demo',
            reason: null,
          },
        },
      },
    ),
  ).rejects.toThrow('Run workflow is frozen');
  expect((await Run.findById(run._id))!.workflow).toBe('chief-of-staff');
});
it('roster is a deterministic bounded20 window and excludes paused/insufficient/unknown permission definitions', async () => {
  const f = await fixture();
  for (let index = 0; index < 23; index++)
    await Agent.create({
      owner,
      name: 'Eligible ' + index,
      role: 'Draft',
      skills: ['research'],
      permissions: ['task.read', 'artifact.draft'],
    });
  await Agent.create({
    owner,
    name: 'PAUSED_ROSTER_MARKER',
    role: 'Draft',
    status: 'paused',
    permissions: ['task.read', 'artifact.draft'],
  });
  await Agent.create({
    owner,
    name: 'INSUFFICIENT_ROSTER_MARKER',
    role: 'Draft',
    permissions: ['task.read'],
  });
  const unknown = await Agent.create({
    owner,
    name: 'UNKNOWN_PERMISSION_ROSTER_MARKER',
    role: 'Draft',
    permissions: ['task.read', 'artifact.draft'],
  });
  await Agent.collection.updateOne(
    { _id: unknown._id },
    { $set: { permissions: ['task.read', 'artifact.draft', 'future.admin'] } },
  );
  const response = await execute(f.run._id);
  expect(response.status).toBe(200);
  const sources = response.body.run.context.sources.filter(
    (source: { kind: string }) => source.kind === 'agent',
  );
  expect(sources).toHaveLength(20);
  const ids = sources.map((source: { id: string }) => source.id);
  expect(ids).toEqual([...ids].sort());
  const context = JSON.stringify(sources);
  expect(context).not.toContain('PAUSED_ROSTER_MARKER');
  expect(context).not.toContain('INSUFFICIENT_ROSTER_MARKER');
  expect(context).not.toContain('UNKNOWN_PERMISSION_ROSTER_MARKER');
});
it('oversized captured roster fails before model invocation or claim', async () => {
  const f = await fixture();
  for (let index = 0; index < 20; index++)
    await Agent.create({
      owner,
      name: 'Large roster ' + index,
      role: 'x'.repeat(80),
      skills: Array.from({ length: 20 }, (_, n) => ('skill-' + n + '-').padEnd(40, 'x')),
      permissions: ['task.read', 'artifact.draft'],
    });
  const response = await execute(f.run._id);
  expect(response.status).toBe(400);
  expect((await Run.findById(f.run._id))!.status).toBe('queued');
});
