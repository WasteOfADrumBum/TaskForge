import { store } from '../redux/store';
import { expireSession, SessionExpiredError } from '../utils/session';

// Keep the original request snapshot across fetch and body-reading continuations.
const responseSessions = new WeakMap<Response, number>();

export const isCurrentSession = (token: string, sessionVersion: number): boolean => {
  const auth = store.getState().auth;
  return auth.token === token && auth.sessionVersion === sessionVersion;
};

export const assertCurrentSession = (token: string, sessionVersion: number): void => {
  if (!isCurrentSession(token, sessionVersion)) throw new SessionExpiredError();
};

export const authenticatedFetch = async (url: string, options: RequestInit): Promise<Response> => {
  const token = new Headers(options.headers).get('Authorization')?.replace(/^Bearer /, '');
  const sessionVersion = store.getState().auth.sessionVersion;
  if (!token) throw new SessionExpiredError();
  assertCurrentSession(token, sessionVersion);
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    assertCurrentSession(token, sessionVersion);
    throw error;
  }
  if (response.status === 401) {
    // An old request must not sign out a newer session, even if its JWT string repeats.
    if (isCurrentSession(token, sessionVersion)) expireSession(store.dispatch);
    throw new SessionExpiredError();
  }
  assertCurrentSession(token, sessionVersion);
  responseSessions.set(response, sessionVersion);
  return response;
};

// Response bodies can finish after logout or a new login, even after fetch resolved.
export const readAuthenticatedJson = async <T>(response: Response, token: string): Promise<T> => {
  const sessionVersion = responseSessions.get(response);
  if (sessionVersion === undefined) throw new SessionExpiredError();
  try {
    return (await response.json()) as T;
  } finally {
    // Also discard stale body failures; never recapture a new session after an await.
    assertCurrentSession(token, sessionVersion);
  }
};
