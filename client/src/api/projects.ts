import { finishApiResponse } from './request';
import { authenticatedFetch, readAuthenticatedJson } from './authenticatedFetch';
import { API_URL, authHeaders, getErrorMessage } from './http';
import type { Project, ProjectInput, ProjectUpdate } from '../types/project';

// Same contract as api/tasks.ts: errors throw Error(serverMessage), and a 401 expires the
// session through authenticatedFetch.

export const getProjects = async (token: string, signal?: AbortSignal): Promise<Project[]> => {
  const response = await authenticatedFetch(API_URL + '/api/projects', {
    signal,
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to load projects', token));
  }
  const data = await readAuthenticatedJson<{ projects: Project[] }>(response, token);
  return data.projects;
};

export const createProject = async (token: string, input: ProjectInput): Promise<Project> => {
  const response = await authenticatedFetch(API_URL + '/api/projects', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to create project', token));
  }
  const data = await readAuthenticatedJson<{ project: Project }>(response, token);
  return data.project;
};

export const updateProject = async (
  token: string,
  projectId: string,
  updates: ProjectUpdate,
): Promise<Project> => {
  const response = await authenticatedFetch(API_URL + '/api/projects/' + projectId, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to update project', token));
  }
  const data = await readAuthenticatedJson<{ project: Project }>(response, token);
  return data.project;
};

export const deleteProject = async (token: string, projectId: string): Promise<void> => {
  const response = await authenticatedFetch(API_URL + '/api/projects/' + projectId, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to delete project', token));
  }
  finishApiResponse(response);
};
