export interface SuppliedResearchSource {
  title: string;
  text: string;
  referenceUrl?: string;
}
export type RunWorkflow = 'draft' | 'chief-of-staff' | 'research' | 'developer' | 'knowledge';
export type RunStatus =
  'queued' | 'running' | 'awaiting-approval' | 'approved' | 'rejected' | 'failed';
export type ReviewDecision = 'approved' | 'rejected';
export interface AgentRun {
  _id?: string;
  id?: string;
  task: string;
  agent: string;
  input: string;
  handoff?: {
    parent: string;
    ancestors: string[];
    sourceVersion: number;
    sourceResultDigest: string;
  } | null;
  context?: unknown;
  contextDigest?: string | null;
  result: unknown;
  resultDigest: string | null;
  status: RunStatus;
  version: number;
  workflow?: RunWorkflow;
  executionMode: 'demo' | 'local' | null;
  createdAt: string;
  updatedAt?: string;
  failureReason?: string | null;
  idempotencyKey?: string;
  auditEvents?: RunAuditEvent[];
  review?: {
    decision: ReviewDecision;
    note: string;
    at: string;
    reviewedVersion: number;
    resultDigest: string;
  } | null;
}
export const getRunId = (run: AgentRun) => run._id ?? run.id ?? '';

export interface RunAuditEvent {
  id: string;
  at: string;
  actor: string;
  kind: 'created' | 'claimed' | 'drafted' | 'failed' | 'expired' | 'approved' | 'rejected';
  from: RunStatus | null;
  to: RunStatus;
  version: number;
  workflow?: RunWorkflow | null;
  mode: 'demo' | 'local' | null;
  reason: string | null;
  resultDigest?: string | null;
  contextDigest?: string | null;
  parentRun?: string | null;
  sourceResultDigest?: string | null;
}
export interface RunInput {
  taskId: string;
  agentId: string;
  input: string;
}
export interface RunProviderStatus {
  defaultMode: 'disabled' | 'local';
  available: false;
  capabilities: { chat: boolean; structuredOutput: boolean; embeddings: boolean };
}
export const runStatusLabel: Record<RunStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  'awaiting-approval': 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
  failed: 'Failed',
};
