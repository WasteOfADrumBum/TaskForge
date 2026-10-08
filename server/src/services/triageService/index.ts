import {
  AIProviderError,
  type AIProvider,
  type ChatMessage,
  type ProviderOptions,
  type RuntimeSchema,
} from '../../ai/provider';
import { TASK_PRIORITIES } from '../../models/taskModel';
import type { RunContextSnapshot } from '../contextService';
export interface TriageRecommendation {
  summary: string;
  proposal: {
    taskId: string;
    agentId: string | null;
    priority: (typeof TASK_PRIORITIES)[number];
    reason: string;
  };
}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 1000;
const exactKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
export const makeTriageSchema = (
  taskId: string,
  agentIds: readonly string[],
): RuntimeSchema<TriageRecommendation> => ({
  jsonSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'proposal'],
    properties: {
      summary: { type: 'string', minLength: 1, maxLength: 1000 },
      proposal: {
        type: 'object',
        additionalProperties: false,
        required: ['taskId', 'agentId', 'priority', 'reason'],
        properties: {
          taskId: { type: 'string', enum: [taskId] },
          agentId: { type: ['string', 'null'], enum: [...agentIds, null] },
          priority: { type: 'string', enum: [...TASK_PRIORITIES] },
          reason: { type: 'string', minLength: 1, maxLength: 1000 },
        },
      },
    },
  },
  validate: (value: unknown): value is TriageRecommendation =>
    object(value) &&
    exactKeys(value, ['summary', 'proposal']) &&
    text(value.summary) &&
    object(value.proposal) &&
    exactKeys(value.proposal, ['taskId', 'agentId', 'priority', 'reason']) &&
    value.proposal.taskId === taskId &&
    (value.proposal.agentId === null ||
      (typeof value.proposal.agentId === 'string' && agentIds.includes(value.proposal.agentId))) &&
    TASK_PRIORITIES.includes(value.proposal.priority as never) &&
    text(value.proposal.reason),
});
export const buildDemoTriage = (snapshot: RunContextSnapshot): TriageRecommendation => {
  const task = snapshot.sources.find((source) => source.kind === 'task');
  if (!task || !TASK_PRIORITIES.includes(task.priority as never))
    throw new AIProviderError('INVALID_REQUEST');
  const content = ((task.title ?? '') + ' ' + task.description).toLowerCase();
  const candidates = snapshot.sources
    .filter((source) => source.kind === 'agent')
    .map((source) => ({
      source,
      score: (source.skills ?? [])
        .flatMap((skill) => skill.split('-'))
        .filter((word) => word.length >= 4 && content.includes(word)).length,
    }))
    .sort((a, b) => b.score - a.score || a.source.id.localeCompare(b.source.id));
  const match = candidates[0]?.score ? candidates[0].source : null;
  return {
    summary:
      'Rule-based simulation: review this task priority and assignment suggestion. No AI model was called.',
    proposal: {
      taskId: task.id,
      agentId: match?.id ?? null,
      priority: /\b(urgent|overdue|blocked)\b/.test(content) ? 'high' : task.priority!,
      reason: match
        ? 'A captured skill tag matches the task text. This is a deterministic demo rule, not inference.'
        : 'No captured skill tag matches. No alternative agent is proposed; review the task manually.',
    },
  };
};
export const formatTriageOutput = (value: TriageRecommendation, snapshot?: RunContextSnapshot) => {
  const name = snapshot?.sources.find(
    (source) => source.kind === 'agent' && source.id === value.proposal.agentId,
  )?.name;
  return (
    value.summary +
    '\nSuggested priority: ' +
    value.proposal.priority +
    '\nSuggested agent: ' +
    (value.proposal.agentId
      ? name
        ? name + ' (' + value.proposal.agentId + ')'
        : value.proposal.agentId
      : 'No alternative proposed') +
    '\nReason: ' +
    value.proposal.reason +
    '\nReview records this proposal only; no task changes are applied.'
  );
};
export const executeTriage = async (
  provider: AIProvider,
  snapshot: RunContextSnapshot,
  messages: readonly ChatMessage[],
  options: ProviderOptions,
) => {
  if (!provider.capabilities.structuredOutput) throw new AIProviderError('UNSUPPORTED');
  const task = snapshot.sources.find((source) => source.kind === 'task');
  if (!task) throw new AIProviderError('INVALID_REQUEST');
  const schema = makeTriageSchema(
    task.id,
    snapshot.sources.filter((source) => source.kind === 'agent').map((source) => source.id),
  );
  if (provider.id === 'demo') {
    const canned = await provider.structuredOutput(
      messages,
      {
        validate: (value: unknown): value is { summary: string; simulated: true } =>
          object(value) &&
          exactKeys(value, ['summary', 'simulated']) &&
          text(value.summary) &&
          value.simulated === true,
      },
      options,
    );
    if (
      !object(canned.value) ||
      !exactKeys(canned.value, ['summary', 'simulated']) ||
      !text(canned.value.summary) ||
      canned.value.simulated !== true
    )
      throw new AIProviderError('INVALID_OUTPUT');
    const value = buildDemoTriage(snapshot);
    if (!schema.validate(value)) throw new AIProviderError('INVALID_OUTPUT');
    return { ...canned, value, label: canned.label + ' Rule-based triage simulation.' };
  }
  const result = await provider.structuredOutput(messages, schema, options);
  if (!schema.validate(result.value)) throw new AIProviderError('INVALID_OUTPUT');
  return result;
};
