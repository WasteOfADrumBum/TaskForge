import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import routes from './index';
import { recordRunDenial, AuditUnavailableError } from '../../services/auditService';
jest.mock('../../services/auditService', () => ({
  ...jest.requireActual('../../services/auditService'),
  recordRunDenial: jest.fn(),
}));
import { createOwnedHandoff, listOwnedHandoffs, HandoffError } from '../../services/handoffService';
jest.mock('../../services/handoffService', () => {
  const actual = jest.requireActual('../../services/handoffService');
  return { ...actual, createOwnedHandoff: jest.fn(), listOwnedHandoffs: jest.fn() };
});
const app = express();
app.use(express.json());
app.use('/api/runs', routes);
const owner = '507f1f77bcf86cd799439011';
const parent = '507f1f77bcf86cd799439012';
const task = '507f1f77bcf86cd799439013';
const agent = '507f1f77bcf86cd799439014';
const auth = { Authorization: 'Bearer ' + jwt.sign({ id: owner }, 'test-jwt-secret') };
const key = 'handoff-key-123456';
const body = {
  taskId: task,
  agentId: agent,
  input: 'Explicit next work',
  version: 3,
  resultDigest: 'a'.repeat(64),
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(recordRunDenial).mockResolvedValue(undefined as never);
});
it.each([
  undefined,
  'Bearer malformed',
  'Bearer ' + jwt.sign({ id: owner }, 'wrong-secret'),
  'Bearer ' + jwt.sign({ id: owner }, 'test-jwt-secret', { expiresIn: -1 }),
])('rejects invalid authentication before handoff writes or reads (%s)', async (authorization) => {
  const post = request(app)
    .post('/api/runs/' + parent + '/handoff')
    .send(body);
  const get = request(app).get('/api/runs/' + parent + '/handoffs');
  if (authorization) {
    post.set('Authorization', authorization);
    get.set('Authorization', authorization);
  }
  expect((await post).status).toBe(401);
  expect((await get).status).toBe(401);
  expect(createOwnedHandoff).not.toHaveBeenCalled();
  expect(listOwnedHandoffs).not.toHaveBeenCalled();
});
it.each([
  {},
  { ...body, taskId: 'bad' },
  { ...body, agentId: [] },
  { ...body, input: '' },
  { ...body, input: 'x'.repeat(8001) },
  { ...body, version: -1 },
  { ...body, version: 0.5 },
  { ...body, resultDigest: null },
  { ...body, resultDigest: 'a'.repeat(63) },
  { ...body, resultDigest: 'G'.repeat(64) },
])('validates handoff body before services (%s)', async (value) => {
  const response = await request(app)
    .post('/api/runs/' + parent + '/handoff')
    .set(auth)
    .set('Idempotency-Key', key)
    .send(value);
  expect(response.status).toBe(400);
  expect(createOwnedHandoff).not.toHaveBeenCalled();
});
it.each([undefined, 'short', 'bad key with spaces'])(
  'requires a valid stable creation key (%s)',
  async (value) => {
    const call = request(app)
      .post('/api/runs/' + parent + '/handoff')
      .set(auth)
      .send(body);
    if (value) call.set('Idempotency-Key', value);
    expect((await call).status).toBe(400);
    expect(createOwnedHandoff).not.toHaveBeenCalled();
  },
);
it.each([true, false])('derives owner and allowlists fields for created=%s', async (created) => {
  jest
    .mocked(createOwnedHandoff)
    .mockResolvedValue({ run: { _id: task, status: 'queued' }, created } as never);
  const response = await request(app)
    .post('/api/runs/' + parent + '/handoff')
    .set(auth)
    .set('Idempotency-Key', key)
    .send({
      ...body,
      owner: agent,
      context: { secret: true },
      handoff: { ancestors: [] },
      status: 'approved',
    });
  expect(response.status).toBe(created ? 201 : 200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(createOwnedHandoff).toHaveBeenCalledWith(owner, parent, { ...body, idempotencyKey: key });
});
it.each([400, 403, 404, 409, 503] as const)('maps safe handoff error HTTP %s', async (status) => {
  jest
    .mocked(createOwnedHandoff)
    .mockRejectedValue(new HandoffError(status, 'Safe handoff failure'));
  const response = await request(app)
    .post('/api/runs/' + parent + '/handoff')
    .set(auth)
    .set('Idempotency-Key', key)
    .send(body);
  expect(response.status).toBe(status);
  expect(response.body).toEqual({ message: 'Safe handoff failure' });
});
it('hides unexpected errors and does not replay writes', async () => {
  jest.mocked(createOwnedHandoff).mockRejectedValue(new Error('SECRET_DB_DETAILS'));
  const response = await request(app)
    .post('/api/runs/' + parent + '/handoff')
    .set(auth)
    .set('Idempotency-Key', key)
    .send(body);
  expect(response.status).toBe(503);
  expect(response.body).toEqual({ message: 'Run execution is temporarily unavailable' });
  expect(createOwnedHandoff).toHaveBeenCalledTimes(1);
});
it('scopes history to authenticated owner and hides foreign parent', async () => {
  jest
    .mocked(listOwnedHandoffs)
    .mockResolvedValueOnce([] as never)
    .mockResolvedValueOnce(null);
  const response = await request(app)
    .get('/api/runs/' + parent + '/handoffs')
    .set(auth);
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ runs: [] });
  expect(response.headers['cache-control']).toBe('no-store');
  expect(listOwnedHandoffs).toHaveBeenCalledWith(owner, parent);
  expect(
    (
      await request(app)
        .get('/api/runs/' + parent + '/handoffs')
        .set(auth)
    ).status,
  ).toBe(404);
});
it('rejects malformed parent IDs without lookup or writes', async () => {
  expect((await request(app).get('/api/runs/bad/handoffs').set(auth)).status).toBe(404);
  expect(
    (
      await request(app)
        .post('/api/runs/bad/handoff')
        .set(auth)
        .set('Idempotency-Key', key)
        .send(body)
    ).status,
  ).toBe(404);
  expect(createOwnedHandoff).not.toHaveBeenCalled();
  expect(listOwnedHandoffs).not.toHaveBeenCalled();
});
it('awaits invalid body denial audit and fails closed if durable audit is unavailable', async () => {
  jest.mocked(recordRunDenial).mockRejectedValueOnce(new AuditUnavailableError());
  const response = await request(app)
    .post('/api/runs/' + parent + '/handoff')
    .set(auth)
    .set('Idempotency-Key', key)
    .send({});
  expect(response.status).toBe(503);
  expect(recordRunDenial).toHaveBeenCalledWith(owner, parent, 'invalid-handoff', 'handoff');
  expect(createOwnedHandoff).not.toHaveBeenCalled();
});
it('records malformed parent write denial with no unsafe attempted ID', async () => {
  const response = await request(app)
    .post('/api/runs/malformed/handoff')
    .set(auth)
    .set('Idempotency-Key', key)
    .send(body);
  expect(response.status).toBe(404);
  expect(recordRunDenial).toHaveBeenCalledWith(owner, null, 'run-not-found', 'handoff');
  expect(createOwnedHandoff).not.toHaveBeenCalled();
});
