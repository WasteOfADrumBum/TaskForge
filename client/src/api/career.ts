import { authenticatedFetch, readAuthenticatedJson } from './authenticatedFetch';
import { finishApiResponse } from './request';
import { API_URL, authHeaders, getErrorMessage } from './http';
import type { JobInput, JobUpdate, SavedJob, Skill, SkillInput, SkillLevel } from '../types/career';

// Same contract as api/goals.ts: errors throw Error(serverMessage), and a 401 expires the
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
const one = (id: string) => '/' + encodeURIComponent(id);

export const getSkills = async (token: string, signal?: AbortSignal) =>
  (await send<{ skills: Skill[] }>(token, '/api/skills', 'Unable to load skills', { signal }))!
    .skills;
export const createSkill = async (token: string, input: SkillInput) =>
  (await send<{ skill: Skill }>(token, '/api/skills', 'Unable to add skill', {
    method: 'POST',
    body: JSON.stringify(input),
  }))!.skill;
export const updateSkill = async (token: string, id: string, updates: { level: SkillLevel }) =>
  (await send<{ skill: Skill }>(token, '/api/skills' + one(id), 'Unable to update skill', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }))!.skill;
export const deleteSkill = async (token: string, id: string) => {
  await send(token, '/api/skills' + one(id), 'Unable to remove skill', { method: 'DELETE' });
};

export const getJobs = async (token: string, signal?: AbortSignal) =>
  (await send<{ jobs: SavedJob[] }>(token, '/api/jobs', 'Unable to load saved jobs', { signal }))!
    .jobs;
export const createJob = async (token: string, input: JobInput) =>
  (await send<{ job: SavedJob }>(token, '/api/jobs', 'Unable to save job', {
    method: 'POST',
    body: JSON.stringify(input),
  }))!.job;
export const updateJob = async (token: string, id: string, updates: JobUpdate) =>
  (await send<{ job: SavedJob }>(token, '/api/jobs' + one(id), 'Unable to update job', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }))!.job;
export const deleteJob = async (token: string, id: string) => {
  await send(token, '/api/jobs' + one(id), 'Unable to delete job', { method: 'DELETE' });
};
