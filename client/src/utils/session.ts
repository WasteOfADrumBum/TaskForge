import type { AppDispatch } from '../redux/store';
import { sessionExpired, SESSION_EXPIRED_MESSAGE } from '../redux/slices/authSlice';

export { SESSION_EXPIRED_MESSAGE };

export class SessionExpiredError extends Error {
  constructor() {
    super(SESSION_EXPIRED_MESSAGE);
    this.name = 'SessionExpiredError';
  }
}

// This is a UI check only; the server still verifies the signature and expiration.
export const isTokenExpired = (token: string): boolean => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
    };
    return (
      typeof payload.exp !== 'number' ||
      !Number.isFinite(payload.exp) ||
      payload.exp * 1000 <= Date.now()
    );
  } catch {
    return true;
  }
};

export const expireSession = (dispatch: AppDispatch) => {
  localStorage.removeItem('token');
  dispatch(sessionExpired());
};
