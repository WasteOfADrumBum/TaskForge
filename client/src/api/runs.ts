import { authenticatedFetch, readAuthenticatedJson } from './authenticatedFetch';
import { API_URL, authHeaders, getErrorMessage } from './http';
import {
  getRunId,
  type AgentRun,
  type ReviewDecision,
  type RunWorkflow,
  type RunAuditEvent,
  type RunInput,
  type RunProviderStatus,
} from '../types/run';

export const getRunApprovals = async (
  token: string,
  agentId: string,
  signal?: AbortSignal,
): Promise<AgentRun[]> => {
  const response = await authenticatedFetch(
    API_URL + '/api/runs/approvals?agentId=' + encodeURIComponent(agentId),
    { signal, headers: authHeaders(token) },
  );
  if (!response.ok)
    throw new Error(await getErrorMessage(response, 'Unable to load drafts', token));
  return (await readAuthenticatedJson<{ runs: AgentRun[] }>(response, token)).runs;
};

// Send the exact version/digest shown to the human. Never retry an uncertain decision.
export const reviewRunDraft = async (
  token: string,
  run: AgentRun,
  decision: ReviewDecision,
  note: string,
  signal?: AbortSignal,
): Promise<AgentRun> => {
  if (!run.resultDigest || run.status !== 'awaiting-approval')
    throw new Error('Refresh before reviewing this draft.');
  const response = await authenticatedFetch(API_URL + '/api/runs/' + getRunId(run) + '/review', {
    method: 'POST',
    signal,
    headers: authHeaders(token),
    body: JSON.stringify({ decision, version: run.version, resultDigest: run.resultDigest, note }),
  });
  if (!response.ok)
    throw new Error(await getErrorMessage(response, 'Unable to record decision', token));
  return (await readAuthenticatedJson<{ run: AgentRun }>(response, token)).run;
};

export class RunApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const readRunEndpoint = async <T>(
  token: string,
  path: string,
  signal?: AbortSignal,
): Promise<T> => {
  const response = await authenticatedFetch(API_URL + path, {
    signal,
    headers: authHeaders(token),
  });
  if (!response.ok)
    throw new RunApiError(
      response.status,
      await getErrorMessage(response, 'Unable to load run activity', token),
    );
  return readAuthenticatedJson<T>(response, token);
};
export const getRuns = async (token: string, signal?: AbortSignal): Promise<AgentRun[]> =>
  (await readRunEndpoint<{ runs: AgentRun[] }>(token, '/api/runs', signal)).runs;
export const getRun = async (token: string, id: string, signal?: AbortSignal): Promise<AgentRun> =>
  (await readRunEndpoint<{ run: AgentRun }>(token, '/api/runs/' + encodeURIComponent(id), signal))
    .run;
export const getRunAudit = async (
  token: string,
  id: string,
  signal?: AbortSignal,
): Promise<RunAuditEvent[]> =>
  (
    await readRunEndpoint<{ events: RunAuditEvent[] }>(
      token,
      '/api/runs/' + encodeURIComponent(id) + '/audit',
      signal,
    )
  ).events;
export const getRunProviderStatus = (
  token: string,
  signal?: AbortSignal,
): Promise<RunProviderStatus> => readRunEndpoint(token, '/api/ai/status', signal);
const writeRunEndpoint = async (
  token: string,
  path: string,
  body: unknown,
  signal?: AbortSignal,
  key?: string,
): Promise<AgentRun> => {
  const response = await authenticatedFetch(API_URL + path, {
    method: 'POST',
    signal,
    headers: { ...authHeaders(token), ...(key ? { 'Idempotency-Key': key } : {}) },
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new RunApiError(
      response.status,
      await getErrorMessage(response, 'Unable to update run', token),
    );
  return (await readAuthenticatedJson<{ run: AgentRun }>(response, token)).run;
};
export const createRun = (token: string, input: RunInput, key: string, signal?: AbortSignal) =>
  writeRunEndpoint(
    token,
    '/api/runs',
    { taskId: input.taskId, agentId: input.agentId, input: input.input },
    signal,
    key,
  );
export const executeRun = (
  token: string,
  id: string,
  mode: 'demo' | 'local',
  includeProject = false,
  signal?: AbortSignal,
  workflow: RunWorkflow = 'draft',
) =>
  writeRunEndpoint(
    token,
    '/api/runs/' + encodeURIComponent(id) + '/execute',
    { mode, includeProject, ...(workflow !== 'draft' && { workflow }) },
    signal,
  );
export const cancelRun = (token: string, id: string, signal?: AbortSignal) =>
  writeRunEndpoint(token, '/api/runs/' + encodeURIComponent(id) + '/cancel', {}, signal);
