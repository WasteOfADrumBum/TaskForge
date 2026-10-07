export type RunStatus =
  'queued' | 'running' | 'awaiting-approval' | 'approved' | 'rejected' | 'failed';
export type ReviewDecision = 'approved' | 'rejected';
export interface AgentRun {
  _id?: string;
  id?: string;
  task: string;
  agent: string;
  input: string;
  context?: unknown;
  contextDigest?: string | null;
  result: unknown;
  resultDigest: string | null;
  status: RunStatus;
  version: number;
  executionMode: 'demo' | 'local' | null;
  createdAt: string;
  review?: {
    decision: ReviewDecision;
    note: string;
    at: string;
    reviewedVersion: number;
    resultDigest: string;
  } | null;
}
export const getRunId = (run: AgentRun) => run._id ?? run.id ?? '';
