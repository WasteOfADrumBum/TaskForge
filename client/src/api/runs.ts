import { authenticatedFetch, readAuthenticatedJson } from './authenticatedFetch';
import { API_URL, authHeaders, getErrorMessage } from './http';
import { getRunId, type AgentRun, type ReviewDecision } from '../types/run';

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
): Promise<AgentRun> => {
  if (!run.resultDigest || run.status !== 'awaiting-approval')
    throw new Error('Refresh before reviewing this draft.');
  const response = await authenticatedFetch(API_URL + '/api/runs/' + getRunId(run) + '/review', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ decision, version: run.version, resultDigest: run.resultDigest, note }),
  });
  if (!response.ok)
    throw new Error(await getErrorMessage(response, 'Unable to record decision', token));
  return (await readAuthenticatedJson<{ run: AgentRun }>(response, token)).run;
};
