import { finishApiResponse } from './request';
import { authenticatedFetch, readAuthenticatedJson } from './authenticatedFetch';
import { API_URL, authHeaders, getErrorMessage } from './http';
import type { Agent, AgentInput, AgentUpdate } from '../types/agent';

// Same contract as api/projects.ts: errors throw Error(serverMessage), and a 401 expires the
// session through authenticatedFetch.

export const getAgents = async (token: string, signal?: AbortSignal): Promise<Agent[]> => {
  const response = await authenticatedFetch(API_URL + '/api/agents', {
    signal,
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to load agents', token));
  }
  const data = await readAuthenticatedJson<{ agents: Agent[] }>(response, token);
  return data.agents;
};

export const createAgent = async (token: string, input: AgentInput): Promise<Agent> => {
  const response = await authenticatedFetch(API_URL + '/api/agents', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to create agent', token));
  }
  const data = await readAuthenticatedJson<{ agent: Agent }>(response, token);
  return data.agent;
};

export const updateAgent = async (
  token: string,
  agentId: string,
  updates: AgentUpdate,
): Promise<Agent> => {
  const response = await authenticatedFetch(API_URL + '/api/agents/' + agentId, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to update agent', token));
  }
  const data = await readAuthenticatedJson<{ agent: Agent }>(response, token);
  return data.agent;
};

export const deleteAgent = async (token: string, agentId: string): Promise<void> => {
  const response = await authenticatedFetch(API_URL + '/api/agents/' + agentId, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to delete agent', token));
  }
  finishApiResponse(response);
};
