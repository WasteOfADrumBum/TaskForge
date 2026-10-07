import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import routes from './index';
import {
  createOwnedRun,
  getOwnedRun,
  listOwnedRuns,
  RunInputError,
} from '../../services/runService';
jest.mock('../../services/runService', () => {
  const actual = jest.requireActual('../../services/runService');
  return { ...actual, createOwnedRun: jest.fn(), getOwnedRun: jest.fn(), listOwnedRuns: jest.fn() };
});
const app = express();
app.use(express.json());
app.use('/api/runs', routes);
const owner = '507f1f77bcf86cd799439011';
const id = '507f1f77bcf86cd799439012';
const agent = '507f1f77bcf86cd799439013';
const auth = { Authorization: `Bearer ${jwt.sign({ id: owner }, 'test-jwt-secret')}` };
const body = { taskId: id, agentId: agent, input: 'Synthetic input' };
const key = 'synthetic-key-1234';
beforeEach(() => jest.clearAllMocks());
it('requires authentication before any run access', async () => {
  expect((await request(app).get('/api/runs')).status).toBe(401);
  expect(listOwnedRuns).not.toHaveBeenCalled();
});
it.each([
  [],
  null,
  {},
  { ...body, input: '' },
  { ...body, input: 'x'.repeat(8001) },
  { ...body, taskId: 'invalid' },
  { ...body, agentId: {} },
])('rejects invalid creation %s before services', async (value) => {
  expect(
    (
      await request(app)
        .post('/api/runs')
        .set(auth)
        .set('Idempotency-Key', key)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(value))
    ).status,
  ).toBe(400);
  expect(createOwnedRun).not.toHaveBeenCalled();
});
it('requires a stable valid idempotency header', async () => {
  expect((await request(app).post('/api/runs').set(auth).send(body)).status).toBe(400);
  expect(createOwnedRun).not.toHaveBeenCalled();
});
it('passes only allowed owner-controlled fields and returns the idempotent HTTP status', async () => {
  jest.mocked(createOwnedRun).mockResolvedValue({ run: { _id: id }, created: false } as never);
  const response = await request(app)
    .post('/api/runs')
    .set(auth)
    .set('Idempotency-Key', key)
    .send({ ...body, owner: agent, context: { injected: true }, status: 'approved' });
  expect(response.status).toBe(200);
  expect(createOwnedRun).toHaveBeenCalledWith(owner, { ...body, idempotencyKey: key });
});
it('returns typed idempotency conflicts and generic unexpected errors', async () => {
  jest.mocked(createOwnedRun).mockRejectedValueOnce(new RunInputError(409, 'Conflict'));
  expect(
    (await request(app).post('/api/runs').set(auth).set('Idempotency-Key', key).send(body)).status,
  ).toBe(409);
  jest.mocked(createOwnedRun).mockRejectedValueOnce(new Error('private DB details'));
  expect(
    (await request(app).post('/api/runs').set(auth).set('Idempotency-Key', key).send(body)).body,
  ).toEqual({ message: 'Server error' });
});
it('lists only owner records without caching private run data', async () => {
  jest.mocked(listOwnedRuns).mockResolvedValue([] as never);
  const response = await request(app).get('/api/runs').set(auth);
  expect(response.body).toEqual({ runs: [] });
  expect(response.headers['cache-control']).toBe('no-store');
  expect(listOwnedRuns).toHaveBeenCalledWith(owner);
});
it('hides malformed IDs without service work', async () => {
  expect((await request(app).get('/api/runs/not-an-id').set(auth)).status).toBe(404);
  expect(getOwnedRun).not.toHaveBeenCalled();
});
it('blocks execution after owner lookup without executing or mutating anything', async () => {
  jest
    .mocked(getOwnedRun)
    .mockResolvedValueOnce({ _id: id } as never)
    .mockResolvedValueOnce(null);
  expect((await request(app).post(`/api/runs/${id}/execute`).set(auth)).status).toBe(503);
  expect((await request(app).post(`/api/runs/${id}/execute`).set(auth)).status).toBe(404);
  expect(getOwnedRun).toHaveBeenCalledWith(owner, id);
  expect(createOwnedRun).not.toHaveBeenCalled();
});
