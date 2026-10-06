import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { login, logout, register } from './auth';

const fetchMock = vi.fn();

describe('auth API', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('logs in and returns the token', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ message: 'Logged in successfully', token: 'jwt-token' }),
    } as unknown as Response);

    const result = await login({ email: 'test@example.com', password: 'Password123!' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:5000/api/auth/login',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.token).toBe('jwt-token');
  });

  it('surfaces the API login error message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ message: 'Invalid credentials' }),
    } as unknown as Response);

    await expect(login({ email: 'test@example.com', password: 'wrong-password' })).rejects.toThrow(
      'Invalid credentials',
    );
  });

  it('registers a user', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        message: 'User created',
        user: { id: 'user-id', email: 'test@example.com' },
      }),
    } as unknown as Response);

    const result = await register({ email: 'test@example.com', password: 'Password123!' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:5000/api/auth/register',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.user.email).toBe('test@example.com');
  });

  it.each([
    ['login', login],
    ['register', register],
  ])('surfaces %s throttling feedback without retrying', async (_name, action) => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Too many attempts. Try again later.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      }),
    );

    await expect(
      action({ email: 'test@example.com', password: 'Password123!long' }),
    ).rejects.toThrow('Too many attempts. Try again later.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('logs out through the API', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: vi.fn() } as unknown as Response);

    await logout();

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:5000/api/auth/logout', {
      method: 'POST',
      signal: expect.any(AbortSignal),
    });
  });
});
