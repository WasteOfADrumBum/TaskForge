import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import app from '../src/app';
import { User } from '../src/models/userModel';
import { Task } from '../src/models/taskModel';
import { Agent } from '../src/models/agentModel';
import { Run } from '../src/models/runModel';
import { AuditEvent } from '../src/models/auditEventModel';
const parent = process.env.TEST_MONGO_URI;
if (
  !parent ||
  parent !== parent.trim() ||
  !/^mongodb:\/\/(?:127\.0\.0\.1|localhost):\d{1,5}\/taskforge_qa_[a-zA-Z0-9_]{8,}$/.test(parent)
)
  throw new Error('Reviews require fresh loopback QA namespace');
let owner: string;
let task: string;
let agent: string;
let token: string;
let otherToken: string;
const auth = (value = token) => ({ Authorization: `Bearer ${value}` });
const draft = async () => {
  const create = await request(app)
    .post('/api/runs')
    .set(auth())
    .set('Idempotency-Key', randomUUID())
    .send({ taskId: task, agentId: agent, input: 'Synthetic draft for exact review' });
  expect(create.status).toBe(201);
  const execute = await request(app)
    .post(`/api/runs/${create.body.run._id}/execute`)
    .set(auth())
    .send({ mode: 'demo' });
  expect(execute.status).toBe(200);
  return execute.body.run as { _id: string; version: number; resultDigest: string };
};
const review = (
  run: { _id: string; version: number; resultDigest: string },
  body: Record<string, unknown> = {},
  value = token,
) =>
  request(app)
    .post(`/api/runs/${run._id}/review`)
    .set(auth(value))
    .send({ decision: 'approved', version: run.version, resultDigest: run.resultDigest, ...body });
beforeAll(async () => {
  await mongoose.connect(parent + '_reviews', {
    serverSelectionTimeoutMS: 5000,
    autoCreate: false,
    autoIndex: false,
  });
  const db = mongoose.connection.db;
  if (!db || (await db.listCollections().toArray()).length)
    throw new Error('Refusing pre-existing review collections');
  for (const model of [User, Task, Agent, Run, AuditEvent]) {
    await model.createCollection();
    await model.createIndexes();
  }
  const user = await User.create({
    email: 'review-owner@taskforge-qa.example',
    password: 'unused',
  });
  owner = user.id;
  const other = await User.create({
    email: 'review-other@taskforge-qa.example',
    password: 'unused',
  });
  token = jwt.sign({ id: owner }, process.env.JWT_SECRET!);
  otherToken = jwt.sign({ id: other.id }, process.env.JWT_SECRET!);
  const a = await Agent.create({
    owner,
    name: 'Review agent',
    role: 'Draft',
    permissions: ['task.read', 'artifact.draft'],
  });
  agent = a.id;
  const t = await Task.create({
    owner,
    title: 'Review task',
    assigneeType: 'agent',
    assigneeAgent: agent,
  });
  task = t.id;
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await mongoose.disconnect();
});
it.each(['approved', 'rejected'])(
  'records owner %s bound to exact result/version and no workspace changes',
  async (decision) => {
    const run = await draft();
    const before = (await Task.findById(task))!.toObject();
    const response = await review(run, {
      decision,
      note: 'Private REVIEW_NOTE_MARKER',
      owner: 'spoof',
      permissions: ['task.update'],
    });
    expect(response.status).toBe(200);
    expect(response.body.run).toMatchObject({
      status: decision,
      version: run.version + 1,
      resultDigest: run.resultDigest,
      review: {
        decision,
        note: 'Private REVIEW_NOTE_MARKER',
        reviewedVersion: run.version,
        resultDigest: run.resultDigest,
      },
    });
    expect((await Task.findById(task))!.toObject()).toEqual(before);
    expect(JSON.stringify(response.body.run.auditEvents)).not.toContain('REVIEW_NOTE_MARKER');
    expect(response.body.run.auditEvents.at(-1)).toMatchObject({
      kind: decision,
      resultDigest: run.resultDigest,
    });
  },
);
it('returns only owned awaiting-approval records with no-store and bounded filtering', async () => {
  const run = await draft();
  const response = await request(app)
    .get('/api/runs/approvals')
    .query({ agentId: agent })
    .set(auth());
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body.runs.some((item: { _id: string }) => item._id === run._id)).toBe(true);
  expect((await request(app).get('/api/runs/approvals').set(auth(otherToken))).body.runs).toEqual(
    [],
  );
  expect(
    (await request(app).get('/api/runs/approvals').query({ 'agentId[$ne]': 'x' }).set(auth()))
      .status,
  ).toBe(400);
});
it('hides foreign review records and keeps the owner state unchanged', async () => {
  const run = await draft();
  expect((await review(run, {}, otherToken)).status).toBe(404);
  expect((await Run.findById(run._id))!.status).toBe('awaiting-approval');
  expect(await AuditEvent.countDocuments({ attemptedRun: run._id, action: 'review' })).toBe(1);
});
it('rejects stale version/digest and duplicate decisions without changing result or audit history', async () => {
  const run = await draft();
  expect((await review(run, { version: run.version + 1 })).status).toBe(409);
  expect((await review(run, { resultDigest: 'a'.repeat(64) })).status).toBe(409);
  expect((await review(run)).status).toBe(200);
  expect((await review(run, { decision: 'rejected' })).status).toBe(409);
  const stored = (await Run.findById(run._id))!;
  expect(stored.version).toBe(run.version + 1);
  expect(
    stored.auditEvents.filter((event) => event.kind === 'approved' || event.kind === 'rejected'),
  ).toHaveLength(1);
});
it('concurrent opposing decisions have exactly one atomic winner', async () => {
  const run = await draft();
  const results = await Promise.all([review(run), review(run, { decision: 'rejected' })]);
  expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
  expect((await Run.findById(run._id))!.version).toBe(run.version + 1);
});
it.each([
  { note: 'x'.repeat(2001) },
  { note: {} },
  { resultDigest: null },
  { version: 2.5 },
  { decision: 'apply' },
])('rejects malformed review %s', async (body) => {
  const run = await draft();
  expect((await review(run, body)).status).toBe(400);
  expect((await Run.findById(run._id))!.status).toBe('awaiting-approval');
});
it('fails closed when review/audit persistence fails', async () => {
  const run = await draft();
  jest
    .spyOn(Run, 'findOneAndUpdate')
    .mockRejectedValueOnce(new Error('Synthetic audit failure') as never);
  expect((await review(run)).status).toBe(503);
  expect((await Run.findById(run._id))!.status).toBe('awaiting-approval');
});

it('rejects a result changed after the owned snapshot read but before review persistence', async () => {
  const run = await draft();
  const original = Run.findOneAndUpdate.bind(Run);
  jest.spyOn(Run, 'findOneAndUpdate').mockImplementationOnce((...args) => {
    return (async () => {
      // Test-only direct driver mutation models a competing writer at the read/CAS boundary.
      // It touches only this suite's fresh synthetic record, without reset/drop or production data.
      await Run.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(run._id), owner: new mongoose.Types.ObjectId(owner) },
        {
          $set: {
            result: {
              text: 'Changed after preview',
              provider: 'demo',
              simulation: true,
              label: 'Simulation',
            },
          },
        },
      );
      return await original(...args);
    })() as never;
  });
  expect((await review(run)).status).toBe(409);
  const stored = (await Run.findById(run._id))!;
  expect(stored.status).toBe('awaiting-approval');
  expect(stored.version).toBe(run.version);
  expect(stored.review).toBeNull();
  expect(
    stored.auditEvents.filter((event) => event.kind === 'approved' || event.kind === 'rejected'),
  ).toHaveLength(0);
});

it.each([{ result: { $ne: null } }, { result: ['one'] }, { result: 'one' }, { result: '$result' }])(
  'reviews unchanged literal JSON output %j without interpreting it as a query',
  async ({ result }) => {
    const run = await draft();
    await Run.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(run._id) },
      { $set: { result } },
    );
    const snapshot = (
      await request(app)
        .get('/api/runs/' + run._id)
        .set(auth())
    ).body.run;
    expect((await review(snapshot)).status).toBe(200);
    const stored = (await Run.findById(run._id))!;
    expect(stored.result).toEqual(result);
    expect(stored.review?.resultDigest).toBe(snapshot.resultDigest);
  },
);
it.each([
  { before: { $ne: null }, after: 'changed output' },
  { before: 'one', after: ['one'] },
  { before: ['one'], after: [['one']] },
  { before: '$result', after: 'changed output' },
])('fences literal output changed between read and CAS %j', async ({ before, after }) => {
  const run = await draft();
  await Run.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(run._id) },
    { $set: { result: before } },
  );
  const snapshot = (
    await request(app)
      .get('/api/runs/' + run._id)
      .set(auth())
  ).body.run;
  const original = Run.findOneAndUpdate.bind(Run);
  jest.spyOn(Run, 'findOneAndUpdate').mockImplementationOnce(
    (...args) =>
      (async () => {
        // Only this suite's guarded fresh synthetic record changes at the read/CAS boundary.
        await Run.collection.updateOne(
          { _id: new mongoose.Types.ObjectId(run._id) },
          { $set: { result: after } },
        );
        return await original(...args);
      })() as never,
  );
  expect((await review(snapshot)).status).toBe(409);
  const stored = (await Run.findById(run._id))!;
  expect(stored.status).toBe('awaiting-approval');
  expect(stored.version).toBe(snapshot.version);
  expect(stored.review).toBeNull();
  expect(
    stored.auditEvents.filter((event) => event.kind === 'approved' || event.kind === 'rejected'),
  ).toHaveLength(0);
});
