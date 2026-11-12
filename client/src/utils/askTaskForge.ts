import type { Agent, AgentPermission } from '../types/agent';
import { getAgentId } from '../types/agent';
import type { KnowledgeHit } from '../types/knowledge';
import type { AgentRun, RunProviderStatus } from '../types/run';
import type { Task } from '../types/task';
import { utf8Bytes } from './knowledge';

// Ask TaskForge (KAN-49) presents two explicit, separately labelled modes. Keyword source
// lookup is the hosted no-model path. Grounded answers are developer-local Runs only.
export type AskMode = 'keyword' | 'grounded';

export const GROUNDED_QUESTION_MAX_BYTES = 480;
export const GROUNDED_REQUIRED_PERMISSIONS: readonly AgentPermission[] = [
  'task.read',
  'artifact.draft',
  'knowledge.read',
];

export type GroundedAvailability =
  { available: true } | { available: false; reason: 'unknown' | 'hosted' | 'missing-capability' };

// Capability metadata describes configuration only; a configured local provider can still fail.
export const groundedAvailability = (
  status: RunProviderStatus | null | undefined,
): GroundedAvailability => {
  if (!status) return { available: false, reason: 'unknown' };
  if (status.defaultMode !== 'local') return { available: false, reason: 'hosted' };
  return status.capabilities.structuredOutput === true && status.capabilities.embeddings === true
    ? { available: true }
    : { available: false, reason: 'missing-capability' };
};

export const groundedUnavailableMessage = (reason: 'unknown' | 'hosted' | 'missing-capability') =>
  reason === 'unknown'
    ? 'AI capability information could not be loaded, so grounded answers are unavailable. Keyword source lookup still works.'
    : reason === 'hosted'
      ? 'Grounded answers need a developer-local AI setup. This TaskForge deployment does not run AI models, so only keyword source lookup is available.'
      : 'The local AI setup lacks embeddings or structured output, so grounded answers are unavailable.';

const hasLoneSurrogate = (text: string) => {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
};

// Mirrors server validKnowledgeQuestion; the server remains authoritative.
export const validGroundedQuestion = (question: string) =>
  !!question.trim() &&
  !hasLoneSurrogate(question) &&
  utf8Bytes(question) <= GROUNDED_QUESTION_MAX_BYTES;

export const agentCanAskKnowledge = (agent: Agent | undefined, includeProject = false) =>
  !!agent &&
  agent.status === 'active' &&
  Array.isArray(agent.permissions) &&
  [...GROUNDED_REQUIRED_PERMISSIONS, ...(includeProject ? (['project.read'] as const) : [])].every(
    (permission) => agent.permissions.includes(permission),
  );

// Client-side eligibility is a convenience filter. The server rechecks current persisted
// assignment, agent status and permissions before claim, draft, publication and approval.
export const groundedEligibleTasks = (tasks: Task[], agents: Agent[]) =>
  tasks.filter(
    (task) =>
      task.assigneeType === 'agent' &&
      !!task.assigneeAgent &&
      agentCanAskKnowledge(agents.find((agent) => getAgentId(agent) === task.assigneeAgent)),
  );

export interface GroundedCitation {
  key: string;
  cited: boolean;
  sourceId: string;
  title: string;
  version: number;
  contentDigest: string;
  start: number;
  end: number;
  quote: string;
  score: number;
}
export interface GroundedRunReport {
  question: string;
  answer: string;
  projectScoped: boolean;
  excerpts: GroundedCitation[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

// Run results are stored server output but are still parsed defensively: any malformed shape
// yields null and the page falls back to the plain recorded text instead of inventing citations.
export const parseGroundedRun = (run: AgentRun | null | undefined): GroundedRunReport | null => {
  if (!run || run.workflow !== 'knowledge' || !isRecord(run.result)) return null;
  const knowledge = run.result.knowledge;
  if (!isRecord(knowledge) || !isRecord(knowledge.retrieval) || !isRecord(knowledge.answer))
    return null;
  const { retrieval, answer } = knowledge;
  if (
    retrieval.mode !== 'semantic' ||
    typeof retrieval.question !== 'string' ||
    typeof answer.answer !== 'string' ||
    !Array.isArray(answer.citations) ||
    !Array.isArray(retrieval.excerpts) ||
    !retrieval.excerpts.length ||
    retrieval.excerpts.length > 3
  )
    return null;
  const cited = new Set<string>();
  for (const key of answer.citations) {
    if (typeof key !== 'string') return null;
    cited.add(key);
  }
  const excerpts: GroundedCitation[] = [];
  for (const [index, item] of retrieval.excerpts.entries()) {
    if (
      !isRecord(item) ||
      item.key !== 'K' + (index + 1) ||
      typeof item.sourceId !== 'string' ||
      !/^[a-f0-9]{24}$/.test(item.sourceId) ||
      typeof item.title !== 'string' ||
      !isCount(item.version) ||
      typeof item.contentDigest !== 'string' ||
      !isCount(item.start) ||
      !isCount(item.end) ||
      item.end <= item.start ||
      item.end - item.start > 240 ||
      typeof item.quote !== 'string' ||
      item.quote.length !== item.end - item.start ||
      typeof item.score !== 'number' ||
      !Number.isFinite(item.score)
    )
      return null;
    excerpts.push({
      key: item.key,
      cited: cited.has(item.key),
      sourceId: item.sourceId,
      title: item.title,
      version: item.version,
      contentDigest: item.contentDigest,
      start: item.start,
      end: item.end,
      quote: item.quote,
      score: item.score,
    });
  }
  if (!cited.size || [...cited].some((key) => !excerpts.some((item) => item.key === key)))
    return null;
  return {
    question: retrieval.question,
    answer: answer.answer,
    projectScoped: typeof retrieval.project === 'string' && !!retrieval.project,
    excerpts,
  };
};

// The knowledge detail page verifies this against the current owned source before showing it
// as current; router state is never trusted on its own.
export const citationToHit = (citation: GroundedCitation): KnowledgeHit => ({
  sourceId: citation.sourceId,
  title: citation.title,
  version: citation.version,
  contentDigest: citation.contentDigest,
  score: citation.score,
  matchedInContent: true,
  citation: { field: 'content', start: citation.start, end: citation.end, quote: citation.quote },
});
