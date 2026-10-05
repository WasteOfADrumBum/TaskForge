import request from 'supertest';
import app from '../../app';
import { findUserByEmail } from '../../services/authService';

jest.mock('../../services/authService', () => ({
  createUser: jest.fn(),
  findUserByEmail: jest.fn().mockResolvedValue(null),
}));

it('applies the real default login limiter before authentication service access', async () => {
  for (let index = 0; index < 10; index++) {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'limited@example.com', password: 'wrong' });
    expect(response.status).toBe(401);
  }
  const blocked = await request(app)
    .post('/api/auth/login')
    .send({ email: ' LIMITED@EXAMPLE.COM ', password: 'wrong' });
  expect(blocked.status).toBe(429);
  expect(blocked.body.message).toMatch(/try again/i);
  expect(findUserByEmail).toHaveBeenCalledTimes(10);
  const unaffected = await request(app)
    .post('/api/auth/login')
    .send({ email: 'other@example.com', password: 'wrong' });
  expect(unaffected.status).toBe(401);
});
