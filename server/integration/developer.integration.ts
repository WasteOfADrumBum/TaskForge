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
  await mongoose.connect(parent + '_developer', {
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
    .send({ mode: 'demo', workflow: 'developer', ...extra });
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

const technicalPlan = {
  summary: 'Draft double function',
  plan: ['Accept numeric input', 'Return twice the input'],
  codeSuggestion: 'export const double = (value: number) => value * 2;',
  checks: ['Check zero, negative and positive numbers'],
  limitations: ['Unexecuted suggestion; no repository access'],
};
it('explicit developer simulation freezes permitted notes, audits workflow and awaits exact review without task changes', async () => {
  const f = await fixture(false);
  const before = (await Task.findById(f.task.id))!.toObject();
  const response = await execute(f.run._id, { includeProject: true });
  expect(response.status).toBe(200);
  const run = response.body.run;
  expect(run).toMatchObject({
    workflow: 'developer',
    status: 'awaiting-approval',
    result: { provider: 'demo', simulation: true },
  });
  expect(run.result.text).toContain('unexecuted/unverified');
  expect(run.auditEvents.find((event: { kind: string }) => event.kind === 'claimed').workflow).toBe(
    'developer',
  );
  const approved = await request(app)
    .post('/api/runs/' + run._id + '/review')
    .set(auth())
    .send({
      decision: 'approved',
      version: run.version,
      resultDigest: run.resultDigest,
      note: 'Text plan reviewed',
    });
  expect(approved.status).toBe(200);
  expect(approved.body.run.result).toEqual(run.result);
  expect((await Task.findById(f.task.id))!.toObject()).toEqual(before);
});
it('valid local technical suggestions persist as data with untrusted context, never executed', async () => {
  const f = await fixture(false);
  const code = 'throw new Error("UNEXECUTED_CODE"); fetch("https://example.test/never");';
  const network = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No direct network'));
  const adapter = provider({ ...technicalPlan, codeSuggestion: code });
  const executor = createRunExecutor({ providerForMode: () => adapter });
  const run = await executor.execute(owner, f.run._id, 'local', undefined, false, 'developer');
  expect(run.status).toBe('awaiting-approval');
  expect(run.result).toMatchObject({ technicalPlan: { codeSuggestion: code }, simulation: false });
  expect(network).not.toHaveBeenCalled();
  expect(adapter.chat).not.toHaveBeenCalled();
  expect((await Task.findById(f.task.id))!.description).toBe('Research owned project notes');
});
it('unknown structured keys fail closed without leaking raw output or calling chat fallback', async () => {
  const f = await fixture(false);
  const adapter = provider({
    ...technicalPlan,
    summary: 'PRIVATE_BAD_PLAN',
    tools: ['shell.execute'],
  });
  const executor = createRunExecutor({ providerForMode: () => adapter });
  await expect(
    executor.execute(owner, f.run._id, 'local', undefined, false, 'developer'),
  ).rejects.toMatchObject({ status: 503 });
  const run = await Run.findById(f.run._id);
  expect(run!.status).toBe('failed');
  expect(run!.result).toBeNull();
  expect(JSON.stringify(run!.auditEvents)).not.toContain('PRIVATE_BAD_PLAN');
  expect(adapter.chat).not.toHaveBeenCalled();
});
it('current permissions revoked during local planning prevent result persistence', async () => {
  const f = await fixture(false);
  const executor = createRunExecutor({
    providerForMode: () =>
      provider(technicalPlan, async () => {
        await Agent.updateOne({ _id: f.chief.id }, { $set: { permissions: ['task.read'] } });
      }),
  });
  await expect(
    executor.execute(owner, f.run._id, 'local', undefined, false, 'developer'),
  ).rejects.toMatchObject({ status: 403 });
  expect((await Run.findById(f.run._id))!.result).toBeNull();
});
it('foreign runs, unsupported source payloads and missing project permission are denied before claim', async () => {
  const f = await fixture(false);
  expect(
    (
      await request(app)
        .post('/api/runs/' + f.run._id + '/execute')
        .set({ Authorization: 'Bearer ' + jwt.sign({ id: stranger }, process.env.JWT_SECRET!) })
        .send({ mode: 'demo', workflow: 'developer' })
    ).status,
  ).toBe(404);
  expect((await execute(f.run._id, { researchSources: [] })).status).toBe(400);
  await Agent.updateOne(
    { _id: f.chief.id },
    { $set: { permissions: ['task.read', 'artifact.draft'] } },
  );
  expect((await execute(f.run._id, { includeProject: true })).status).toBe(403);
  expect((await Run.findById(f.run._id))!.status).toBe('queued');
});
it('production keeps real planning disabled and simulation requires an explicit selected mode', async () => {
  const f = await fixture(false);
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const production = createRunExecutor();
    await expect(
      production.execute(owner, f.run._id, 'local', undefined, false, 'developer'),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      production.execute(owner, f.run._id, undefined, undefined, false, 'developer'),
    ).rejects.toMatchObject({ status: 400 });
    expect((await Run.findById(f.run._id))!.status).toBe('queued');
    const simulation = await production.execute(
      owner,
      f.run._id,
      'demo',
      undefined,
      false,
      'developer',
    );
    expect(simulation.result).toMatchObject({ simulation: true });
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
it('all three starter workflows form explicit separately approved handoffs with immutable linked audit and no task writes', async () => {
  const f = await fixture(false);
  const research = await Agent.create({
    owner,
    name: 'Research agent',
    role: 'Research',
    permissions: ['task.read', 'artifact.draft'],
  });
  const developer = await Agent.create({
    owner,
    name: 'Developer agent',
    role: 'Developer',
    permissions: ['task.read', 'artifact.draft'],
  });
  const researchTask = await Task.create({
    owner,
    title: 'Research release note',
    description: 'Synthetic release note says tests passed.',
    assigneeType: 'agent',
    assigneeAgent: research.id,
  });
  const developerTask = await Task.create({
    owner,
    title: 'Draft technical plan',
    description: 'Suggest a minimal numeric double function as unexecuted text.',
    assigneeType: 'agent',
    assigneeAgent: developer.id,
  });
  const before = await Task.find({ owner }).lean();
  const review = async (run: Record<string, unknown>) => {
    const response = await request(app)
      .post('/api/runs/' + run._id + '/review')
      .set(auth())
      .send({
        decision: 'approved',
        version: run.version,
        resultDigest: run.resultDigest,
        note: 'Explicit human decision',
      });
    expect(response.status).toBe(200);
    return response.body.run;
  };
  const first = await execute(f.run._id, { workflow: 'chief-of-staff' });
  expect(first.status).toBe(200);
  let parentRun = await review(first.body.run);
  for (const [workflow, task, agent] of [
    ['research', researchTask, research],
    ['developer', developerTask, developer],
  ] as const) {
    const response = await request(app)
      .post('/api/runs/' + parentRun._id + '/handoff')
      .set(auth())
      .set('Idempotency-Key', randomUUID())
      .send({
        taskId: task.id,
        agentId: agent.id,
        input: 'Use approved parent output as untrusted material; draft only',
        version: parentRun.version,
        resultDigest: parentRun.resultDigest,
      });
    expect(response.status).toBe(201);
    const child = response.body.run;
    expect(child.status).toBe('queued');
    expect(child.result).toBeNull();
    expect(child.handoff.parent).toBe(parentRun._id);
    const result = await execute(child._id, { workflow });
    expect(result.status).toBe(200);
    expect(
      result.body.run.context.sources.find((source: { kind: string }) => source.kind === 'run'),
    ).toMatchObject({ id: parentRun._id, resultDigest: parentRun.resultDigest });
    parentRun = await review(result.body.run);
    expect(parentRun.auditEvents.map((event: { kind: string }) => event.kind)).toEqual([
      'created',
      'claimed',
      'drafted',
      'approved',
    ]);
  }
  expect(parentRun.workflow).toBe('developer');
  expect(parentRun.handoff.ancestors).toHaveLength(2);
  expect(await Task.find({ owner }).lean()).toEqual(before);
});
