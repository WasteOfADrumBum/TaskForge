import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import app from '../src/app';
import { User } from '../src/models/userModel';
import { Task } from '../src/models/taskModel';
import { Agent } from '../src/models/agentModel';
import { Run } from '../src/models/runModel';
import {
  claimRun,
  completeRun,
  failRun,
  recoverExpiredRun,
  reviewRun,
} from '../src/services/runService';

const parentUri = process.env.TEST_MONGO_URI;
if (
  !parentUri ||
  parentUri !== parentUri.trim() ||
  !/^mongodb:\/\/(?:127\.0\.0\.1|localhost):\d{1,5}\/taskforge_qa_[a-zA-Z0-9_]{8,}$/.test(parentUri)
)
  throw new Error('Run integration requires a fresh loopback taskforge_qa_ database');
const uri = parentUri + '_runs';
let aliceId: string;
let bobId: string;
let taskId: string;
let agentId: string;
let aliceToken: string;
let bobToken: string;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const post = (key = randomUUID(), extra: Record<string, unknown> = {}, token = aliceToken) =>
  request(app)
    .post('/api/runs')
    .set(auth(token))
    .set('Idempotency-Key', key)
    .send({ taskId, agentId, input: 'Synthetic run input', ...extra });
const create = async () => {
  const response = await post();
  expect(response.status).toBe(201);
  return response.body.run._id as string;
};

beforeAll(async () => {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    autoCreate: false,
    autoIndex: false,
  });
  const db = mongoose.connection.db;
  if (!db || (await db.listCollections().toArray()).length)
    throw new Error('Run integration refuses existing collections');
  for (const model of [User, Task, Agent, Run]) {
    await model.createCollection();
    if (model.modelName !== 'Run') await model.createIndexes();
  }
  const initialRunIndexes = await Run.collection.listIndexes().toArray();
  expect(
    initialRunIndexes.some(
      (index) => index.unique === true && index.key.owner === 1 && index.key.idempotencyKey === 1,
    ),
  ).toBe(false);
  const alice = await User.create({
    email: 'alice-runs@taskforge-qa.example',
    password: 'unused-synthetic-hash',
  });
  const bob = await User.create({
    email: 'bob-runs@taskforge-qa.example',
    password: 'unused-synthetic-hash',
  });
  aliceId = alice.id;
  bobId = bob.id;
  aliceToken = jwt.sign({ id: aliceId }, process.env.JWT_SECRET!);
  bobToken = jwt.sign({ id: bobId }, process.env.JWT_SECRET!);
  const agent = await Agent.create({
    owner: aliceId,
    name: 'Synthetic agent',
    role: 'Synthetic researcher',
  });
  agentId = agent.id;
  const task = await Task.create({
    owner: aliceId,
    title: 'Synthetic task',
    assigneeType: 'agent',
    assigneeAgent: agentId,
  });
  taskId = task.id;
});
afterAll(async () => {
  await mongoose.disconnect();
});

it('establishes the actual unique index before concurrent first-ever run creates', async () => {
  const key = randomUUID();
  const responses = await Promise.all([post(key), post(key), post(key)]);
  expect(responses.map((response) => response.status).sort()).toEqual([200, 200, 201]);
  expect(await Run.countDocuments({ owner: aliceId, idempotencyKey: key })).toBe(1);
  const indexes = await Run.collection.listIndexes().toArray();
  expect(
    indexes.some(
      (index) =>
        index.unique === true &&
        index.key.owner === 1 &&
        index.key.idempotencyKey === 1 &&
        !index.sparse &&
        !index.partialFilterExpression,
    ),
  ).toBe(true);
});

it('persists queued records with server-owned data and no provider/task execution', async () => {
  const response = await post(randomUUID(), {
    owner: bobId,
    status: 'approved',
    context: { injected: true },
    result: 'injected',
    attemptId: 'injected',
    version: 88,
  });
  expect(response.status).toBe(201);
  expect(response.body.run).toMatchObject({
    owner: aliceId,
    task: taskId,
    agent: agentId,
    input: 'Synthetic run input',
    context: {},
    result: null,
    status: 'queued',
    version: 0,
  });
  expect(response.body.run).not.toHaveProperty('attemptId');
  expect(response.body.run).not.toHaveProperty('requestFingerprint');
  expect((await Task.findById(taskId))?.status).toBe('todo');
  const execute = await request(app)
    .post(`/api/runs/${response.body.run._id}/execute`)
    .set(auth(aliceToken));
  expect(execute.status).toBe(403);
  expect((await Run.findById(response.body.run._id))?.status).toBe('queued');
});

it('provides owner-only lists/details and hides foreign execution records', async () => {
  const id = await create();
  expect((await request(app).get(`/api/runs/${id}`).set(auth(aliceToken))).status).toBe(200);
  expect((await request(app).get('/api/runs').set(auth(bobToken))).body.runs).toEqual([]);
  for (const method of ['get', 'post'] as const) {
    const url = `/api/runs/${id}` + (method === 'post' ? '/execute' : '');
    expect((await request(app)[method](url).set(auth(bobToken))).status).toBe(404);
  }
  expect((await post(randomUUID(), {}, bobToken)).status).toBe(400);
});

it('does not expose mutation, deletion, or approval endpoints', async () => {
  const id = await create();
  expect(
    (await request(app).patch(`/api/runs/${id}`).set(auth(aliceToken)).send({ status: 'approved' }))
      .status,
  ).toBe(404);
  expect((await request(app).delete(`/api/runs/${id}`).set(auth(aliceToken))).status).toBe(404);
  expect((await request(app).post(`/api/runs/${id}/approve`).set(auth(aliceToken))).status).toBe(
    404,
  );
});

it('reuses identical idempotent creation and rejects changed input', async () => {
  const key = randomUUID();
  const initial = await post(key);
  const repeated = await post(key);
  expect(initial.status).toBe(201);
  expect(repeated.status).toBe(200);
  expect(repeated.body.run._id).toBe(initial.body.run._id);
  expect((await post(key, { input: 'Different input' })).status).toBe(409);
  expect(await Run.countDocuments({ owner: aliceId, idempotencyKey: key })).toBe(1);
});

it('concurrent duplicate creation has exactly one stored record', async () => {
  const key = randomUUID();
  const results = await Promise.all([post(key), post(key), post(key)]);
  expect(results.map((result) => result.status).sort()).toEqual([200, 200, 201]);
  expect(new Set(results.map((result) => result.body.run._id)).size).toBe(1);
  expect(await Run.countDocuments({ owner: aliceId, idempotencyKey: key })).toBe(1);
});

it('concurrent claims fence a single attempt with bounded deadlines', async () => {
  const id = await create();
  const now = new Date();
  const results = await Promise.all([
    claimRun(aliceId, id, 0, 120000, now),
    claimRun(aliceId, id, 0, 120000, now),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  const claimed = results.find(Boolean)!;
  expect(claimed.status).toBe('running');
  expect(claimed.version).toBe(1);
  expect(claimed.attemptId).toBeTruthy();
  expect(claimed.workDeadline!.getTime() - now.getTime()).toBe(120000);
  expect(claimed.leaseExpiresAt!.getTime() - now.getTime()).toBe(125000);
  expect(await claimRun(bobId, id, 1)).toBeNull();
});

it('concurrent completion only persists the fenced winner and cannot overwrite its draft', async () => {
  const id = await create();
  const claimed = (await claimRun(aliceId, id, 0))!;
  expect(await completeRun(aliceId, id, 1, 'stale-attempt', { summary: 'wrong' })).toBeNull();
  expect(await completeRun(bobId, id, 1, claimed.attemptId!, { summary: 'foreign' })).toBeNull();
  const results = await Promise.all([
    completeRun(aliceId, id, 1, claimed.attemptId!, { summary: 'first' }),
    completeRun(aliceId, id, 1, claimed.attemptId!, { summary: 'second' }),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect((await Run.findById(id))?.status).toBe('awaiting-approval');
  expect(
    await completeRun(aliceId, id, 1, claimed.attemptId!, { summary: 'retry overwrite' }),
  ).toBeNull();
});

it.each(['approved', 'rejected'] as const)(
  'makes %s decisions terminal and version-fenced without task writes',
  async (decision) => {
    const id = await create();
    const running = (await claimRun(aliceId, id, 0))!;
    await completeRun(aliceId, id, 1, running.attemptId!, { summary: 'Draft only' });
    const reviewed = await reviewRun(aliceId, id, 2, decision);
    expect(reviewed?.status).toBe(decision);
    await expect(
      reviewRun(aliceId, id, 2, decision === 'approved' ? 'rejected' : 'approved'),
    ).rejects.toMatchObject({ status: 409 });
    expect(await claimRun(aliceId, id, 3)).toBeNull();
    expect(await failRun(aliceId, id, 3, 'queued', null, 'interrupted')).toBeNull();
    expect((await Task.findById(taskId))?.status).toBe('todo');
  },
);

it('recovers an expired interrupted attempt once and rejects stale completion/replay', async () => {
  const id = await create();
  const started = new Date('2026-01-01T00:00:00.000Z');
  const running = (await claimRun(aliceId, id, 0, 100, started))!;
  expect(
    await recoverExpiredRun(aliceId, id, 1, running.attemptId!, new Date(started.getTime() + 99)),
  ).toBeNull();
  expect(
    await recoverExpiredRun(bobId, id, 1, running.attemptId!, new Date(started.getTime() + 200)),
  ).toBeNull();
  const results = await Promise.all([
    recoverExpiredRun(aliceId, id, 1, running.attemptId!, new Date(started.getTime() + 200)),
    recoverExpiredRun(aliceId, id, 1, running.attemptId!, new Date(started.getTime() + 200)),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(results.find(Boolean)?.status).toBe('failed');
  expect(
    await completeRun(aliceId, id, 1, running.attemptId!, { summary: 'Stale result' }, started),
  ).toBeNull();
  expect(await claimRun(aliceId, id, 2)).toBeNull();
});

it.each(['queued', 'running'] as const)(
  'can fail %s records honestly with the current version and attempt',
  async (from) => {
    const id = await create();
    const running = from === 'running' ? await claimRun(aliceId, id, 0) : null;
    const failed = await failRun(
      aliceId,
      id,
      from === 'running' ? 1 : 0,
      from,
      running?.attemptId ?? null,
      'interrupted',
    );
    expect(failed?.status).toBe('failed');
    expect(failed?.failureReason).toBe('interrupted');
    expect(await claimRun(aliceId, id, failed!.version!)).toBeNull();
  },
);

it('cannot complete after the work deadline even before the cleanup lease expires', async () => {
  const id = await create();
  const now = new Date('2026-01-01T00:00:00.000Z');
  const running = (await claimRun(aliceId, id, 0, 100, now))!;
  expect(
    await completeRun(
      aliceId,
      id,
      1,
      running.attemptId!,
      { summary: 'Late' },
      new Date(now.getTime() + 101),
    ),
  ).toBeNull();
  expect((await Run.findById(id))?.status).toBe('running');
});

it('concurrent conflicting idempotency payloads create one record and return a conflict', async () => {
  const key = randomUUID();
  const responses = await Promise.all([
    post(key, { input: 'First payload' }),
    post(key, { input: 'Conflicting payload' }),
  ]);
  expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
  expect(await Run.countDocuments({ owner: aliceId, idempotencyKey: key })).toBe(1);
});

it('refuses to claim a queued record whose agent is no longer active', async () => {
  const id = await create();
  await Agent.updateOne({ _id: agentId, owner: aliceId }, { $set: { status: 'paused' } });
  try {
    expect(await claimRun(aliceId, id, 0)).toBeNull();
    expect((await Run.findById(id))?.status).toBe('queued');
  } finally {
    await Agent.updateOne({ _id: agentId, owner: aliceId }, { $set: { status: 'active' } });
  }
});
