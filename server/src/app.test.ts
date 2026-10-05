import request from 'supertest';
import app from './app';
import { checkReadiness } from './utils/readiness';

jest.mock('./utils/readiness', () => ({ checkReadiness: jest.fn() }));
const mockedReadiness = jest.mocked(checkReadiness);

afterEach(() => {
  jest.resetAllMocks();
});

describe('app', () => {
  it('returns the server root response', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.text).toBe('TaskForge API is running!');
  });

  it('returns a healthy status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('answers a malformed JSON body with a JSON 400 and no stack trace', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Malformed JSON body' });
    expect(response.text).not.toMatch(/at .*\.(js|ts):\d+/);
  });
});

describe('operational endpoints', () => {
  it.each([true, false])(
    'reports database readiness without requiring authentication (ready: %s)',
    async (ready) => {
      mockedReadiness.mockResolvedValue(ready);
      const response = await request(app).get('/ready');
      expect(response.status).toBe(ready ? 200 : 503);
      expect(response.body).toEqual({ status: ready ? 'ready' : 'unavailable' });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(mockedReadiness).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps liveness healthy while the database is unavailable', async () => {
    mockedReadiness.mockResolvedValue(false);
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(mockedReadiness).not.toHaveBeenCalled();
  });

  it('does not expose internal errors from a rejected readiness dependency', async () => {
    mockedReadiness.mockRejectedValue(
      new Error('mongodb://private-db:password@host sensitive detail'),
    );
    const response = await request(app).get('/ready');
    expect(response.status).toBe(503);
    expect(response.text).not.toMatch(/private-db|password|sensitive detail|stack/);
  });

  it('reports unknown release identity in unbundled tests without leaking environment values', async () => {
    const response = await request(app).get('/release');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ commit: 'unknown' });
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
