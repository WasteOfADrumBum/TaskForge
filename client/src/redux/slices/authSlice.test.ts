import { describe, expect, it } from 'vitest';
import reducer, {
  clearAuth,
  sessionExpired,
  setError,
  setLoading,
  setToken,
  SESSION_EXPIRED_MESSAGE,
} from './authSlice';

describe('authentication session generation', () => {
  it.each([setToken('token'), clearAuth(), sessionExpired()])(
    'advances the generation for $type without resetting it',
    (action) => {
      const current = reducer(undefined, { type: 'init' });
      const next = reducer(current, action);
      expect(next.sessionVersion).toBe(current.sessionVersion + 1);
    },
  );

  it('distinguishes repeated identical JWTs across logout and immediate re-login', () => {
    const first = reducer(undefined, setToken('identical-jwt'));
    const cleared = reducer(first, clearAuth());
    const second = reducer(cleared, setToken('identical-jwt'));
    expect(second.token).toBe(first.token);
    expect(second.sessionVersion).toBe(first.sessionVersion + 2);
    expect(second.error).toBeNull();
    expect(cleared.token).toBeNull();
  });

  it('keeps the generation through ordinary loading/error changes and expiry feedback', () => {
    const current = reducer(undefined, setToken('token'));
    const loading = reducer(current, setLoading(true));
    const failure = reducer(loading, setError('Network offline'));
    expect(failure.sessionVersion).toBe(current.sessionVersion);
    expect(failure.loading).toBe(true);
    const expired = reducer(failure, sessionExpired());
    expect(expired.sessionVersion).toBe(current.sessionVersion + 1);
    expect(expired.token).toBeNull();
    expect(expired.loading).toBe(false);
    expect(expired.error).toBe(SESSION_EXPIRED_MESSAGE);
  });
});
