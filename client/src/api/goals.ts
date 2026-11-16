import { authenticatedFetch, readAuthenticatedJson } from './authenticatedFetch';
import { finishApiResponse } from './request';
import { API_URL, authHeaders, getErrorMessage } from './http';
import type { Goal, GoalInput, GoalUpdate } from '../types/goal';

// Same contract as api/projects.ts: errors throw Error(serverMessage), and a 401 expires the
// session through authenticatedFetch.

export const getGoals = async (token: string, signal?: AbortSignal): Promise<Goal[]> => {
  const response = await authenticatedFetch(API_URL + '/api/goals', {
    signal,
    headers: authHeaders(token),
  });
  if (!response.ok) throw new Error(await getErrorMessage(response, 'Unable to load goals', token));
  return (await readAuthenticatedJson<{ goals: Goal[] }>(response, token)).goals;
};

export const createGoal = async (token: string, input: GoalInput): Promise<Goal> => {
  const response = await authenticatedFetch(API_URL + '/api/goals', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await getErrorMessage(response, 'Unable to add goal', token));
  return (await readAuthenticatedJson<{ goal: Goal }>(response, token)).goal;
};

export const updateGoal = async (token: string, goalId: string, updates: GoalUpdate) => {
  const response = await authenticatedFetch(API_URL + '/api/goals/' + encodeURIComponent(goalId), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to update goal', token));
  }
  return (await readAuthenticatedJson<{ goal: Goal }>(response, token)).goal;
};

export const deleteGoal = async (token: string, goalId: string): Promise<void> => {
  const response = await authenticatedFetch(API_URL + '/api/goals/' + encodeURIComponent(goalId), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to delete goal', token));
  }
  finishApiResponse(response);
};
