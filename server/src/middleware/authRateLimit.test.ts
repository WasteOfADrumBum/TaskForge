import express from 'express';
import request from 'supertest';
import { createAuthRateLimiters } from './authRateLimit';

const factories: ReturnType<typeof createAuthRateLimiters>[] = [];
const createTestApp = (options: Parameters<typeof createAuthRateLimiters>[0] = {}) => {
  const limiters = createAuthRateLimiters(options);
  factories.push(limiters);
  const app = express();
  app.set('trust proxy', false);
  app.use(express.json());
  const loginHandler = jest.fn((req, res) =>
    res
      .status(req.body.success ? 200 : 401)
      .json({ message: req.body.success ? 'Logged in' : 'Invalid credentials' }),
  );
  const registerHandler = jest.fn((_req, res) => res.status(201).json({ message: 'User created' }));
  app.post('/login', ...limiters.login, loginHandler);
  app.post('/register', ...limiters.register, registerHandler);
  return { app, loginHandler, registerHandler };
};

const attempt = (app: express.Express, email: unknown = 'user@example.com', path = '/login') =>
  request(app).post(path).send({ email, password: 'Password123!long' });

afterEach(() => {
  for (const factory of factories.splice(0)) factory.shutdown();
});

describe('authentication rate limiters over HTTP', () => {
  it('allows ten login failures, then blocks before the controller with actionable retry headers', async () => {
    const { app, loginHandler } = createTestApp();
    for (let index = 0; index < 10; index++) expect((await attempt(app)).status).toBe(401);
    const response = await attempt(app);
    expect(response.status).toBe(429);
    expect(response.body).toEqual({ message: expect.stringMatching(/try again/i) });
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(response.headers['ratelimit']).toBeDefined();
    expect(loginHandler).toHaveBeenCalledTimes(10);
    expect(JSON.stringify(response.body)).not.toContain('user@example.com');
  });

  it('shares a bucket across normalized email variants but keeps other accounts independent', async () => {
    const { app } = createTestApp();
    for (let index = 0; index < 10; index++)
      await attempt(app, index % 2 ? ' USER@EXAMPLE.COM ' : 'user@example.com');
    expect((await attempt(app, 'User@Example.com')).status).toBe(429);
    expect((await attempt(app, 'other@example.com')).status).toBe(401);
  });

  it('puts invalid email values in one bounded bucket instead of trusting attacker-controlled keys', async () => {
    const { app } = createTestApp();
    const invalidValues = [
      null,
      '',
      {},
      ['test@example.com'],
      { $ne: null },
      'not-an-email',
      42,
      true,
      '\u0000@example.com',
      false,
    ];
    for (const email of invalidValues) expect((await attempt(app, email)).status).toBe(401);
    expect((await attempt(app, 'still-invalid')).status).toBe(429);
    expect((await attempt(app, 'valid@example.com')).status).toBe(401);
  });

  it('does not let spoofed forwarding headers reset a failed account budget', async () => {
    const { app } = createTestApp();
    for (let index = 0; index < 10; index++) {
      const response = await attempt(app)
        .set('X-Forwarded-For', `203.0.113.${index + 1}`)
        .set('Forwarded', `for=203.0.113.${index + 1}`)
        .set('X-Real-IP', `203.0.113.${index + 1}`);
      expect(response.status).toBe(401);
    }
    expect((await attempt(app).set('X-Forwarded-For', '198.51.100.99')).status).toBe(429);
  });

  it('refunds successful login attempts without erasing preceding failures', async () => {
    const { app } = createTestApp();
    for (let index = 0; index < 9; index++) await attempt(app);
    for (let index = 0; index < 4; index++) {
      const response = await request(app)
        .post('/login')
        .send({ email: 'user@example.com', success: true });
      expect(response.status).toBe(200);
    }
    expect((await attempt(app)).status).toBe(401);
    expect((await attempt(app)).status).toBe(429);
  });

  it('recovers after the login account window expires', async () => {
    const { app } = createTestApp({ loginAccountWindowMs: 1000 });
    for (let index = 0; index < 10; index++) await attempt(app);
    expect((await attempt(app)).status).toBe(429);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect((await attempt(app)).status).toBe(401);
  });

  it('limits rotating login accounts to global capacity before the handler', async () => {
    const { app, loginHandler } = createTestApp();
    for (let index = 0; index < 120; index++)
      expect((await attempt(app, `user${index}@example.com`)).status).toBe(401);
    expect((await attempt(app, 'new@example.com')).status).toBe(429);
    expect(loginHandler).toHaveBeenCalledTimes(120);
    // Global refusal must not consume the account's own allowance.
  });

  it('counts successful logins toward capacity even when account failures are refunded', async () => {
    const { app } = createTestApp();
    for (let index = 0; index < 120; index++) {
      expect(
        (await request(app).post('/login').send({ email: 'user@example.com', success: true }))
          .status,
      ).toBe(200);
    }
    expect((await attempt(app, 'other@example.com')).status).toBe(429);
  });

  it('limits registration to five per account and keeps login budgets separate', async () => {
    const { app, registerHandler } = createTestApp();
    for (let index = 0; index < 5; index++)
      expect((await attempt(app, 'user@example.com', '/register')).status).toBe(201);
    expect((await attempt(app, ' USER@example.COM ', '/register')).status).toBe(429);
    expect(registerHandler).toHaveBeenCalledTimes(5);
    expect((await attempt(app)).status).toBe(401);
    expect((await attempt(app, 'other@example.com', '/register')).status).toBe(201);
  });

  it('bounds registration capacity across rotating emails and recovers independently', async () => {
    const { app, registerHandler } = createTestApp({ registerCapacityWindowMs: 1000 });
    for (let index = 0; index < 20; index++)
      expect((await attempt(app, `user${index}@example.com`, '/register')).status).toBe(201);
    expect((await attempt(app, 'blocked@example.com', '/register')).status).toBe(429);
    expect(registerHandler).toHaveBeenCalledTimes(20);
    expect((await attempt(app)).status).toBe(401);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect((await attempt(app, 'blocked@example.com', '/register')).status).toBe(201);
  });

  it('global rejection runs before the account limiter and does not charge the account', async () => {
    const { app } = createTestApp({ loginCapacityWindowMs: 1000 });
    for (let index = 0; index < 120; index++) await attempt(app, `fill${index}@example.com`);
    for (let index = 0; index < 11; index++)
      expect((await attempt(app, 'untouched@example.com')).status).toBe(429);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    for (let index = 0; index < 10; index++)
      expect((await attempt(app, 'untouched@example.com')).status).toBe(401);
    expect((await attempt(app, 'untouched@example.com')).status).toBe(429);
  });
});
