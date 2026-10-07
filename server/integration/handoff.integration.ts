import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import app from '../src/app';
import { User } from '../src/models/userModel';
import { Task } from '../src/models/taskModel';
import { Agent } from '../src/models/agentModel';
import { Project } from '../src/models/projectModel';
import { Run, digestRunResult } from '../src/models/runModel';
import { AuditEvent } from '../src/models/auditEventModel';
const parent = process.env.TEST_MONGO_URI;
if (
  !parent ||
  !new RegExp(
    '^mongodb://(?:127[.]0[.]0[.]1|localhost):[0-9]{1,5}/taskforge_qa_[a-zA-Z0-9_]{8,}$',
  ).test(parent)
)
  throw new Error('Handoff tests require fresh loopback QA namespace');
let owner: string;
let stranger: string;
let token: string;
const auth = () => ({ Authorization: 'Bearer ' + token });
beforeAll(async () => {
  await mongoose.connect(parent + '_handoff', {
    autoCreate: false,
    autoIndex: false,
    serverSelectionTimeoutMS: 5000,
  });
  const db = mongoose.connection.db;
  if (!db || (await db.listCollections().toArray()).length)
    throw new Error('Refusing pre-existing handoff collections');
  for (const model of [User, Task, Agent, Project, Run, AuditEvent]) {
    await model.createCollection();
    await model.createIndexes();
  }
  owner = (await User.create({ email: 'handoff-owner@example.test', password: 'synthetic-only' }))
    .id;
  stranger = (
    await User.create({ email: 'handoff-other@example.test', password: 'synthetic-only' })
  ).id;
  token = jwt.sign({ id: owner }, process.env.JWT_SECRET!);
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await mongoose.disconnect();
});

const target = async (agentOwner = owner) => {
  const agent = await Agent.create({
    owner: agentOwner,
    name: 'Handoff target',
    role: 'Draft',
    permissions: ['task.read', 'artifact.draft'],
  });
  const task = await Task.create({
    owner: agentOwner,
    title: 'Handoff task',
    description: 'TARGET_NOTE',
    assigneeType: 'agent',
    assigneeAgent: agent.id,
  });
  return { agent, task };
};
const approve = async (id: string) => {
  const executed = await request(app)
    .post('/api/runs/' + id + '/execute')
    .set(auth())
    .send({ mode: 'demo' });
  expect(executed.status).toBe(200);
  const run = executed.body.run;
  const reviewed = await request(app)
    .post('/api/runs/' + id + '/review')
    .set(auth())
    .send({
      decision: 'approved',
      version: run.version,
      resultDigest: run.resultDigest,
      note: 'PRIVATE_REVIEW_NOTE',
    });
  expect(reviewed.status).toBe(200);
  return reviewed.body.run;
};
const root = async () => {
  const { agent, task } = await target();
  const created = await request(app)
    .post('/api/runs')
    .set(auth())
    .set('Idempotency-Key', randomUUID())
    .send({ taskId: task.id, agentId: agent.id, input: 'PRIVATE_PARENT_REQUEST' });
  expect(created.status).toBe(201);
  return { agent, task, run: await approve(created.body.run._id) };
};
const handoff = (
  source: { _id: string; version: number; resultDigest: string },
  selected: Awaited<ReturnType<typeof target>>,
  key = randomUUID(),
) =>
  request(app)
    .post('/api/runs/' + source._id + '/handoff')
    .set(auth())
    .set('Idempotency-Key', key)
    .send({
      taskId: selected.task.id,
      agentId: selected.agent.id,
      input: 'Explicit child work',
      version: source.version,
      resultDigest: source.resultDigest,
      owner: stranger,
      context: { private: 'CALLER_CONTEXT' },
      handoff: { parent: 'CALLER_PARENT' },
    });

it('atomically persists owned queued linkage/audit and executes bounded approved output without source private fields', async () => {
  const source = await root();
  const selected = await target();
  const created = await handoff(source.run, selected);
  expect(created.status).toBe(201);
  const child = created.body.run;
  expect(child).toMatchObject({
    status: 'queued',
    executionMode: null,
    result: null,
    context: {},
    handoff: {
      parent: source.run._id,
      ancestors: [source.run._id],
      sourceVersion: source.run.version,
      sourceResultDigest: source.run.resultDigest,
    },
  });
  expect(child.auditEvents[0]).toMatchObject({
    kind: 'created',
    parentRun: source.run._id,
    sourceResultDigest: source.run.resultDigest,
  });
  const executed = await request(app)
    .post('/api/runs/' + child._id + '/execute')
    .set(auth())
    .send({ mode: 'demo' });
  expect(executed.status).toBe(200);
  expect(executed.body.run.status).toBe('awaiting-approval');
  expect(executed.body.run.review).toBeNull();
  expect(executed.body.run.context.sources).toEqual([
    expect.objectContaining({ kind: 'task', id: selected.task.id, description: 'TARGET_NOTE' }),
    expect.objectContaining({
      kind: 'run',
      id: source.run._id,
      version: source.run.version,
      resultDigest: source.run.resultDigest,
      description: source.run.result.text,
    }),
  ]);
  const context = JSON.stringify(executed.body.run.context);
  for (const marker of [
    'PRIVATE_PARENT_REQUEST',
    'PRIVATE_REVIEW_NOTE',
    'CALLER_CONTEXT',
    'CALLER_PARENT',
  ])
    expect(context).not.toContain(marker);
  expect((await Run.findById(source.run._id))!.status).toBe('approved');
  expect(String((await Task.findById(source.task.id))!.assigneeAgent)).toBe(source.agent.id);
  expect(String((await Task.findById(selected.task.id))!.assigneeAgent)).toBe(selected.agent.id);
});
it('concurrent identical retries produce one child and conflicting payload cannot alias a creation key', async () => {
  const source = await root();
  const selected = await target();
  const key = randomUUID();
  const [one, two] = await Promise.all([
    handoff(source.run, selected, key),
    handoff(source.run, selected, key),
  ]);
  expect([one.status, two.status].sort()).toEqual([200, 201]);
  expect(one.body.run._id).toBe(two.body.run._id);
  expect(await Run.countDocuments({ owner, idempotencyKey: key })).toBe(1);
  const other = await target();
  expect((await handoff(source.run, other, key)).status).toBe(409);
});
it('history and parent reads isolate other owners and do not disclose missing versus foreign source', async () => {
  const source = await root();
  const selected = await target();
  const child = await handoff(source.run, selected);
  const foreignAuth = {
    Authorization: 'Bearer ' + jwt.sign({ id: stranger }, process.env.JWT_SECRET!),
  };
  const missing = new mongoose.Types.ObjectId().toString();
  for (const id of [source.run._id, missing]) {
    const history = await request(app)
      .get('/api/runs/' + id + '/handoffs')
      .set(foreignAuth);
    expect([history.status, history.body]).toEqual([404, { message: 'Run not found' }]);
  }
  const history = await request(app)
    .get('/api/runs/' + source.run._id + '/handoffs')
    .set(auth());
  expect(history.status).toBe(200);
  expect(history.headers['cache-control']).toBe('no-store');
  expect(history.body.runs.map((run: { _id: string }) => run._id)).toEqual([child.body.run._id]);
});
it('nonapproved source cannot create children or inherit approval', async () => {
  const selected = await target();
  const queued = await request(app)
    .post('/api/runs')
    .set(auth())
    .set('Idempotency-Key', randomUUID())
    .send({ taskId: selected.task.id, agentId: selected.agent.id, input: 'Not approved' });
  const other = await target();
  const response = await handoff({ ...queued.body.run, resultDigest: 'a'.repeat(64) }, other);
  expect(response.status).toBe(409);
  expect(await Run.countDocuments({ 'handoff.parent': queued.body.run._id })).toBe(0);
});
it('depth is limited to three edges and no ancestor agent may repeat', async () => {
  const source = await root();
  let parentRun = source.run;
  for (let depth = 1; depth <= 3; depth++) {
    expect((await handoff(parentRun, { agent: source.agent, task: source.task })).status).toBe(400);
    const selected = await target();
    const created = await handoff(parentRun, selected);
    expect(created.status).toBe(201);
    expect(created.body.run.handoff.ancestors).toHaveLength(depth);
    parentRun = await approve(created.body.run._id);
  }
  expect((await handoff(parentRun, await target())).status).toBe(400);
  expect(await Run.countDocuments({ 'handoff.parent': parentRun._id })).toBe(0);
});
it('paused or foreign target and reassigned target task fail before child insertion', async () => {
  const source = await root();
  const selected = await target();
  await Agent.updateOne({ _id: selected.agent.id }, { $set: { status: 'paused' } });
  expect((await handoff(source.run, selected)).status).toBe(400);
  expect((await handoff(source.run, await target(stranger))).status).toBe(400);
  await Agent.updateOne({ _id: selected.agent.id }, { $set: { status: 'active' } });
  await Task.updateOne(
    { _id: selected.task.id },
    { $set: { assigneeType: 'user', assigneeAgent: null } },
  );
  expect((await handoff(source.run, selected)).status).toBe(400);
  expect(await Run.countDocuments({ 'handoff.parent': source.run._id })).toBe(0);
});
it('permission revoked before execution denies queued child without source or task changes', async () => {
  const source = await root();
  const selected = await target();
  const created = await handoff(source.run, selected);
  await Agent.updateOne({ _id: selected.agent.id }, { $set: { permissions: ['task.read'] } });
  const response = await request(app)
    .post('/api/runs/' + created.body.run._id + '/execute')
    .set(auth())
    .send({ mode: 'demo' });
  expect(response.status).toBe(403);
  expect((await Run.findById(created.body.run._id))!.status).toBe('queued');
});
it('ordinary lifecycle updates cannot rewrite immutable handoff envelope', async () => {
  const source = await root();
  const selected = await target();
  const child = (await handoff(source.run, selected)).body.run;
  await expect(
    Run.findOneAndUpdate(
      { _id: child._id, owner, status: 'queued', version: 0 },
      {
        $set: { status: 'failed', 'handoff.sourceVersion': 99 },
        $inc: { version: 1 },
        $push: {
          auditEvents: {
            id: randomUUID(),
            at: new Date(),
            actor: owner,
            kind: 'failed',
            from: 'queued',
            to: 'failed',
            version: 1,
            mode: null,
            reason: 'cancelled',
          },
        },
      },
    ),
  ).rejects.toThrow('Run identity is immutable');
  expect((await Run.findById(child._id))!.handoff!.sourceVersion).toBe(source.run.version);
});
it('child cancellation is independent and does not cascade to approved parent or task assignments', async () => {
  const source = await root();
  const selected = await target();
  const child = (await handoff(source.run, selected)).body.run;
  const cancelled = await request(app)
    .post('/api/runs/' + child._id + '/cancel')
    .set(auth());
  expect(cancelled.status).toBe(200);
  expect(cancelled.body.run.failureReason).toBe('cancelled');
  expect((await Run.findById(source.run._id))!.status).toBe('approved');
  expect(String((await Task.findById(selected.task.id))!.assigneeAgent)).toBe(selected.agent.id);
});
it('oversized approved output is rejected and denial recorded before any child insertion', async () => {
  const source = await root();
  const selected = await target();
  const result = {
    text: '界'.repeat(6000),
    provider: 'demo',
    simulation: true,
    label: 'Synthetic size test',
  };
  const digest = digestRunResult(result)!;
  // Synthetic isolated source corruption/large output fixture, never production data.
  await Run.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(source.run._id) },
    { $set: { result, 'review.resultDigest': digest } },
  );
  const response = await handoff({ ...source.run, resultDigest: digest }, selected);
  expect(response.status).toBe(400);
  expect(await Run.countDocuments({ 'handoff.parent': source.run._id })).toBe(0);
  expect(
    await AuditEvent.countDocuments({
      owner,
      attemptedRun: source.run._id,
      action: 'handoff',
      reason: 'context-too-large',
    }),
  ).toBe(1);
});
it('a changed source digest fails closed when claiming child', async () => {
  const source = await root();
  const selected = await target();
  const child = (await handoff(source.run, selected)).body.run;
  const result = { ...source.run.result, text: 'CHANGED_APPROVED_SOURCE' };
  const digest = digestRunResult(result)!;
  await Run.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(source.run._id) },
    { $set: { result, 'review.resultDigest': digest } },
  );
  const response = await request(app)
    .post('/api/runs/' + child._id + '/execute')
    .set(auth())
    .send({ mode: 'demo' });
  expect(response.status).toBe(403);
  expect(response.body.message).toBe('Run draft permission denied');
  expect((await Run.findById(child._id))!.context).toEqual({});
});

it('owned chain traversal refuses a foreign approved ancestor without leaking source context', async () => {
  const ownSource = await root();
  const child = (await handoff(ownSource.run, await target())).body.run;
  const ownOwner = owner;
  const ownToken = token;
  let foreignSource: Awaited<ReturnType<typeof root>>;
  try {
    owner = stranger;
    token = jwt.sign({ id: stranger }, process.env.JWT_SECRET!);
    foreignSource = await root();
  } finally {
    owner = ownOwner;
    token = ownToken;
  }
  await Run.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(ownSource.run._id) },
    {
      $set: {
        handoff: {
          parent: new mongoose.Types.ObjectId(foreignSource!.run._id),
          ancestors: [new mongoose.Types.ObjectId(foreignSource!.run._id)],
          sourceVersion: foreignSource!.run.version,
          sourceResultDigest: foreignSource!.run.resultDigest,
        },
      },
    },
  );
  await Run.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(child._id) },
    {
      $set: {
        'handoff.ancestors': [
          new mongoose.Types.ObjectId(foreignSource!.run._id),
          new mongoose.Types.ObjectId(ownSource.run._id),
        ],
      },
    },
  );
  const response = await request(app)
    .post('/api/runs/' + child._id + '/execute')
    .set(auth())
    .send({ mode: 'demo' });
  expect(response.status).toBe(403);
  expect(response.body).toEqual({ message: 'Run draft permission denied' });
  expect((await Run.findById(child._id))!.context).toEqual({});
});
