import { ApiTimeoutError, ApiCancelledError, ApiNetworkError } from './request';
// Shared helpers for the authenticated resource APIs (tasks, projects, agents).
import { readAuthenticatedJson } from './authenticatedFetch';
import { SessionExpiredError } from '../utils/session';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

interface ErrorResponse {
  message?: string;
}

export const getErrorMessage = async (response: Response, fallback: string, token: string) => {
  try {
    const body = await readAuthenticatedJson<ErrorResponse>(response, token);
    return body.message ?? fallback;
  } catch (error) {
    if (
      error instanceof SessionExpiredError ||
      error instanceof ApiTimeoutError ||
      error instanceof ApiCancelledError ||
      error instanceof ApiNetworkError
    )
      throw error;
    return fallback;
  }
};

export const authHeaders = (token: string) => ({
  Authorization: 'Bearer ' + token,
  'Content-Type': 'application/json',
});
