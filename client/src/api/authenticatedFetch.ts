import { store } from '../redux/store';
import { expireSession, SessionExpiredError } from '../utils/session';

export const authenticatedFetch = async (url: string, options: RequestInit): Promise<Response> => {
  const token = new Headers(options.headers).get('Authorization')?.replace(/^Bearer /, '');
  if (!token || store.getState().auth.token !== token) throw new SessionExpiredError();
  const response = await fetch(url, options);
  if (response.status === 401) {
    // An old request must not sign out a newly logged-in user.
    if (store.getState().auth.token === token) expireSession(store.dispatch);
    throw new SessionExpiredError();
  }
  if (store.getState().auth.token !== token) throw new SessionExpiredError();
  return response;
};
