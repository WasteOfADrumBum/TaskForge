import { authenticatedFetch, readAuthenticatedJson } from './authenticatedFetch';
import { API_URL, authHeaders, getErrorMessage } from './http';
import { getRunId, type AgentRun, type RunInput } from '../types/run';
export const getHandoffs = async (
  token: string,
  parentId: string,
  signal?: AbortSignal,
): Promise<AgentRun[]> => {
  const response = await authenticatedFetch(
    API_URL + '/api/runs/' + encodeURIComponent(parentId) + '/handoffs',
    { headers: authHeaders(token), signal },
  );
  if (!response.ok)
    throw new Error(await getErrorMessage(response, 'Unable to load handoffs', token));
  return (await readAuthenticatedJson<{ runs: AgentRun[] }>(response, token)).runs;
};
export const createHandoff = async (
  token: string,
  parent: AgentRun,
  input: RunInput,
  key: string,
  signal?: AbortSignal,
): Promise<AgentRun> => {
  if (parent.status !== 'approved' || !parent.resultDigest)
    throw new Error('Refresh the approved parent before creating a handoff.');
  const response = await authenticatedFetch(
    API_URL + '/api/runs/' + encodeURIComponent(getRunId(parent)) + '/handoff',
    {
      method: 'POST',
      signal,
      headers: { ...authHeaders(token), 'Idempotency-Key': key },
      body: JSON.stringify({
        taskId: input.taskId,
        agentId: input.agentId,
        input: input.input,
        version: parent.version,
        resultDigest: parent.resultDigest,
      }),
    },
  );
  if (!response.ok)
    throw new Error(await getErrorMessage(response, 'Unable to create handoff', token));
  return (await readAuthenticatedJson<{ run: AgentRun }>(response, token)).run;
};
