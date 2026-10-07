import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';

const authorization = {
  Authorization: 'Bearer ' + jwt.sign({ id: '507f1f77bcf86cd799439011' }, 'test-jwt-secret'),
};
const originalProvider = process.env.AI_PROVIDER;
afterEach(() => {
  if (originalProvider === undefined) delete process.env.AI_PROVIDER;
  else process.env.AI_PROVIDER = originalProvider;
  jest.restoreAllMocks();
});

describe('read-only AI capability status', () => {
  it('requires authentication', async () => {
    const response = await request(app).get('/api/ai/status');
    expect(response.status).toBe(401);
  });

  it('rejects forged authentication', async () => {
    const response = await request(app)
      .get('/api/ai/status')
      .set('Authorization', 'Bearer ' + jwt.sign({ id: 'owner' }, 'wrong-secret'));
    expect(response.status).toBe(401);
  });

  it('starts without an AI provider and does not contact a model', async () => {
    delete process.env.AI_PROVIDER;
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const response = await request(app).get('/api/ai/status').set(authorization);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({
      configuredProvider: 'disabled',
      defaultMode: 'disabled',
      available: false,
      capabilities: { chat: false, structuredOutput: false, embeddings: false },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not allow request parameters to change production configuration', async () => {
    delete process.env.AI_PROVIDER;
    const response = await request(app)
      .get('/api/ai/status?mode=demo&provider=demo')
      .set(authorization);
    expect(response.status).toBe(200);
    expect(response.body.defaultMode).toBe('disabled');
    expect(response.body.available).toBe(false);
  });

  it('does not disclose unsupported configuration values', async () => {
    process.env.AI_PROVIDER = 'https://secret-key@example.invalid/private-model';
    const response = await request(app).get('/api/ai/status').set(authorization);
    expect(response.status).toBe(200);
    expect(response.body.available).toBe(false);
    expect(JSON.stringify(response.body)).not.toContain('secret-key');
    expect(JSON.stringify(response.body)).not.toContain('example.invalid');
  });

  it('has no execution endpoint', async () => {
    const response = await request(app)
      .post('/api/ai/run')
      .set(authorization)
      .send({ mode: 'demo' });
    expect(response.status).toBe(404);
  });
});
