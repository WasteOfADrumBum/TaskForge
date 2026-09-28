import request from 'supertest';
import app from './app';

describe('app', () => {
  it('returns the server health response', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.text).toBe('Server is running!');
  });
});
