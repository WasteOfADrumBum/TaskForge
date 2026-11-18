jest.mock('../../middleware/authRateLimit', () => ({
  createAuthRateLimiters: () => ({
    login: [],
    register: [],
    forgotPassword: [],
    resetPassword: [],
  }),
}));
jest.mock('../../services/authService', () => ({
  createUser: jest.fn(),
  findUserByEmail: jest.fn(),
}));
jest.mock('../../services/passwordResetService', () => ({
  RESET_TOKEN_TTL_MINUTES: 30,
  isResetTokenShape: (token: unknown) => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token),
  createPasswordResetToken: jest.fn(),
  consumePasswordResetToken: jest.fn(),
  setUserPassword: jest.fn(),
}));
jest.mock('../../services/mailService', () => ({
  getResetEmailConfig: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../app';
import { findUserByEmail } from '../../services/authService';
import {
  consumePasswordResetToken,
  createPasswordResetToken,
  setUserPassword,
} from '../../services/passwordResetService';
import { getResetEmailConfig, sendPasswordResetEmail } from '../../services/mailService';
import {
  FORGOT_PASSWORD_MESSAGE,
  INVALID_RESET_LINK_MESSAGE,
  RESET_EMAIL_UNAVAILABLE_MESSAGE,
} from '../../controllers/authController';

const config = {
  apiKey: 're_test',
  from: 'TaskForge <no-reply@example.com>',
  appUrl: 'https://app.example.com',
};
const token = 'a'.repeat(64);
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getResetEmailConfig).mockReturnValue(config);
  });

  it('rejects a missing or malformed email', async () => {
    for (const body of [{}, { email: 'nope' }, { email: { $ne: '' } }, []]) {
      const response = await request(app).post('/api/auth/forgot-password').send(body);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'Enter a valid email address' });
    }
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it('gives the same answer for a known and an unknown address', async () => {
    jest
      .mocked(findUserByEmail)
      .mockResolvedValueOnce({ id: 'u1', email: 'me@example.com' } as never);
    jest.mocked(createPasswordResetToken).mockResolvedValueOnce(token);
    const known = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: ' Me@Example.com ' });
    await flush();
    jest.mocked(findUserByEmail).mockResolvedValueOnce(null);
    const unknown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'other@example.com' });
    await flush();

    for (const response of [known, unknown]) {
      expect(response.status).toBe(202);
      expect(response.body).toEqual({ message: FORGOT_PASSWORD_MESSAGE });
      expect(response.headers['cache-control']).toBe('no-store');
    }
    expect(findUserByEmail).toHaveBeenNthCalledWith(1, 'me@example.com');
    expect(createPasswordResetToken).toHaveBeenCalledTimes(1);
    expect(createPasswordResetToken).toHaveBeenCalledWith('u1');
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(config, 'me@example.com', token);
  });

  it('still answers 202 when sending fails, without logging the address or token', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest
      .mocked(findUserByEmail)
      .mockResolvedValueOnce({ id: 'u1', email: 'me@example.com' } as never);
    jest.mocked(createPasswordResetToken).mockResolvedValueOnce(token);
    jest.mocked(sendPasswordResetEmail).mockRejectedValueOnce(new Error('provider down'));
    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'me@example.com' });
    await flush();
    expect(response.status).toBe(202);
    expect(errorSpy).toHaveBeenCalledWith('Password reset email could not be sent');
    expect(JSON.stringify(errorSpy.mock.calls)).not.toMatch(/me@example\.com|aaaa/);
    errorSpy.mockRestore();
  });

  it('says reset by email is unavailable when email is not configured, for every address', async () => {
    jest.mocked(getResetEmailConfig).mockReturnValue(null);
    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'me@example.com' });
    await flush();
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ message: RESET_EMAIL_UNAVAILABLE_MESSAGE });
    expect(findUserByEmail).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => jest.clearAllMocks());
  const strong = 'a-new-strong-password';

  it('rejects a malformed token without touching the store', async () => {
    for (const body of [
      {},
      { token: 'short', password: strong },
      { token: { $gt: '' }, password: strong },
    ]) {
      const response = await request(app).post('/api/auth/reset-password').send(body);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: INVALID_RESET_LINK_MESSAGE });
    }
    expect(consumePasswordResetToken).not.toHaveBeenCalled();
  });

  it('applies the registration password policy before using the token', async () => {
    const short = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'a'.repeat(14) });
    const long = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: '\u{1f600}'.repeat(19) });
    expect(short.status).toBe(400);
    expect(short.body).toEqual({ message: 'Password must be at least 15 characters' });
    expect(long.body).toEqual({ message: 'Password must be no more than 72 UTF-8 bytes' });
    expect(consumePasswordResetToken).not.toHaveBeenCalled();
  });

  it('rejects an unknown, used or expired token with one message', async () => {
    jest.mocked(consumePasswordResetToken).mockResolvedValueOnce(null);
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: strong });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: INVALID_RESET_LINK_MESSAGE });
    expect(setUserPassword).not.toHaveBeenCalled();
  });

  it('sets a bcrypt hash of the new password for the token owner', async () => {
    jest.mocked(consumePasswordResetToken).mockResolvedValueOnce('u1');
    jest.mocked(setUserPassword).mockResolvedValueOnce(true);
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: strong });
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(consumePasswordResetToken).toHaveBeenCalledWith(token);
    const [userId, hash] = jest.mocked(setUserPassword).mock.calls[0];
    expect(userId).toBe('u1');
    expect(hash).not.toBe(strong);
    await expect(bcrypt.compare(strong, hash)).resolves.toBe(true);
  });

  it('treats a deleted account as an invalid link and hides store errors', async () => {
    jest.mocked(consumePasswordResetToken).mockResolvedValueOnce('gone');
    jest.mocked(setUserPassword).mockResolvedValueOnce(false);
    const gone = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: strong });
    expect(gone.status).toBe(400);
    jest.mocked(consumePasswordResetToken).mockRejectedValueOnce(new Error('db down'));
    const failed = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: strong });
    expect(failed.status).toBe(500);
    expect(failed.body).toEqual({ message: 'Server error' });
  });
});
