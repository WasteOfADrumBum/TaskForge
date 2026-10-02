import { authenticatedFetch } from './authenticatedFetch';
import { API_URL, authHeaders, getErrorMessage } from './http';
import type { Task, TaskInput, TaskUpdate } from '../types/task';

export const getTasks = async (token: string): Promise<Task[]> => {
  const response = await authenticatedFetch(API_URL + '/api/tasks', {
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to load tasks'));
  }

  const data = (await response.json()) as { tasks: Task[] };
  return data.tasks;
};

export const createTask = async (token: string, input: TaskInput): Promise<Task> => {
  const response = await authenticatedFetch(API_URL + '/api/tasks', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to create task'));
  }

  const data = (await response.json()) as { task: Task };
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
    throw new Error(await getErrorMessage(response, 'Unable to update task'));
  }

  const data = (await response.json()) as { task: Task };
  return data.task;
};

export const deleteTask = async (token: string, taskId: string): Promise<void> => {
  const response = await authenticatedFetch(API_URL + '/api/tasks/' + taskId, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to delete task'));
  }
};
