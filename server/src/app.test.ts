import request from 'supertest';
import app from './app';

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
