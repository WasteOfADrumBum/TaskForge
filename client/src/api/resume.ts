import { authenticatedFetch, readAuthenticatedJson } from './authenticatedFetch';
import { API_URL, authHeaders, getErrorMessage } from './http';
import type { Resume, ResumeInput } from '../types/resume';

// Same contract as api/career.ts: errors throw Error(serverMessage), and a 401 expires the
// session through authenticatedFetch.

export const getResume = async (token: string, signal?: AbortSignal): Promise<Resume | null> => {
  const response = await authenticatedFetch(API_URL + '/api/resume', {
    headers: authHeaders(token),
    signal,
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to load your resume', token));
  }
  return (await readAuthenticatedJson<{ resume: Resume | null }>(response, token)).resume;
};

export const saveResume = async (
  token: string,
  input: ResumeInput,
  signal?: AbortSignal,
): Promise<Resume> => {
  const response = await authenticatedFetch(API_URL + '/api/resume', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to save your resume', token));
  }
  return (await readAuthenticatedJson<{ resume: Resume }>(response, token)).resume;
};
