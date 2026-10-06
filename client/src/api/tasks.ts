import { finishApiResponse } from './request';
import { authenticatedFetch, readAuthenticatedJson } from './authenticatedFetch';
import { API_URL, authHeaders, getErrorMessage } from './http';
import type { Task, TaskInput, TaskUpdate } from '../types/task';

export const getTasks = async (token: string, signal?: AbortSignal): Promise<Task[]> => {
  const response = await authenticatedFetch(API_URL + '/api/tasks', {
    signal,
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to load tasks', token));
  }

  const data = await readAuthenticatedJson<{ tasks: Task[] }>(response, token);
  return data.tasks;
};

export const createTask = async (token: string, input: TaskInput): Promise<Task> => {
  const response = await authenticatedFetch(API_URL + '/api/tasks', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to create task', token));
  }

  const data = await readAuthenticatedJson<{ task: Task }>(response, token);
  return data.task;
};

export const updateTask = async (
  token: string,
  taskId: string,
  updates: TaskUpdate,
): Promise<Task> => {
  const response = await authenticatedFetch(API_URL + '/api/tasks/' + taskId, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to update task', token));
  }

  const data = await readAuthenticatedJson<{ task: Task }>(response, token);
  return data.task;
};

export const deleteTask = async (token: string, taskId: string): Promise<void> => {
  const response = await authenticatedFetch(API_URL + '/api/tasks/' + taskId, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to delete task', token));
  }
  finishApiResponse(response);
};
