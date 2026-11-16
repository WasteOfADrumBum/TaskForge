import { authenticatedFetch, readAuthenticatedJson } from './authenticatedFetch';
import { finishApiResponse } from './request';
import { API_URL, authHeaders, getErrorMessage } from './http';
import type { LearningInput, LearningItem, LearningUpdate } from '../types/learning';

// Same contract as api/career.ts: errors throw Error(serverMessage), and a 401 expires the
// session through authenticatedFetch.

const send = async <T>(
  token: string,
  path: string,
  fallback: string,
  init: RequestInit = {},
): Promise<T | null> => {
  const response = await authenticatedFetch(API_URL + path, {
    ...init,
    headers: authHeaders(token),
  });
  if (!response.ok) throw new Error(await getErrorMessage(response, fallback, token));
  if (response.status === 204) {
    finishApiResponse(response);
    return null;
  }
  return readAuthenticatedJson<T>(response, token);
};
const one = (id: string) => '/api/learning/' + encodeURIComponent(id);

export const getLearning = async (token: string, signal?: AbortSignal) =>
  (await send<{ items: LearningItem[] }>(token, '/api/learning', 'Unable to load your roadmap', {
    signal,
  }))!.items;
export const createLearningItem = async (token: string, input: LearningInput) =>
  (await send<{ item: LearningItem }>(token, '/api/learning', 'Unable to add to your roadmap', {
    method: 'POST',
    body: JSON.stringify(input),
  }))!.item;
export const updateLearningItem = async (token: string, id: string, updates: LearningUpdate) =>
  (await send<{ item: LearningItem }>(token, one(id), 'Unable to update this item', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }))!.item;
export const deleteLearningItem = async (token: string, id: string) => {
  await send(token, one(id), 'Unable to delete this item', { method: 'DELETE' });
};
