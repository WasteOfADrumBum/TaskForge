import { describe, expect, it } from 'vitest';
import type { Agent } from '../types/agent';
import type { AgentRun, RunProviderStatus } from '../types/run';
import type { Task } from '../types/task';
import type { KnowledgeSource } from '../types/knowledge';
import {
  agentCanAskKnowledge,
  citationToHit,
  groundedAvailability,
  groundedEligibleTasks,
  parseGroundedRun,
  validGroundedQuestion,
} from './askTaskForge';
import { isCurrentKnowledgeCitation } from './knowledge';

const status = (
  defaultMode: 'disabled' | 'local',
  capabilities: Partial<RunProviderStatus['capabilities']> = {},
): RunProviderStatus => ({
  defaultMode,
  available: false,
  capabilities: { chat: true, structuredOutput: true, embeddings: true, ...capabilities },
});
const agent = (overrides: Partial<Agent> = {}): Agent => ({
  _id: 'a1',
  name: 'Researcher',
  role: 'Research',
  description: '',
  status: 'active',
  skills: [],
  permissions: ['task.read', 'artifact.draft', 'knowledge.read'],
  ...overrides,
});
const task = (overrides: Partial<Task> = {}): Task =>
  ({
    _id: 't1',
    title: 'Plan launch',
    status: 'todo',
    priority: 'medium',
    assigneeType: 'agent',
    assigneeAgent: 'a1',
    ...overrides,
  }) as Task;
const sourceId = 'a'.repeat(24);
const content = 'Launch checklist: confirm backups before every release.';
const excerpt = (overrides: Record<string, unknown> = {}) => ({
  key: 'K1',
  sourceId,
  title: 'Release notes',
  project: null,
  version: 3,
  contentDigest: 'd'.repeat(64),
  chunkDigest: 'c'.repeat(64),
  chunkStart: 0,
  chunkEnd: content.length,
  start: 18,
  end: 55,
  quote: content.slice(18, 55),
  score: 0.8,
  ...overrides,
});
const run = (knowledge: unknown, workflow: AgentRun['workflow'] = 'knowledge'): AgentRun => ({
  _id: 'r1',
  task: 't1',
  agent: 'a1',
  input: 'When do we confirm backups?',
  result: { text: 'formatted', knowledge, provider: 'ollama', simulation: false },
  resultDigest: 'e'.repeat(64),
  status: 'awaiting-approval',
  version: 3,
  workflow,
  executionMode: 'local',
  createdAt: '',
});
const knowledge = (excerpts: unknown[] = [excerpt()], citations: unknown[] = ['K1']) => ({
  retrieval: {
    mode: 'semantic',
    project: null,
    question: 'When do we confirm backups?',
    excerpts,
  },
  answer: { answer: 'Before every release [K1].', citations },
});

describe('grounded availability', () => {
  it('fails closed when capability is unknown or hosted', () => {
    expect(groundedAvailability(null)).toEqual({ available: false, reason: 'unknown' });
    expect(groundedAvailability(status('disabled'))).toEqual({
      available: false,
      reason: 'hosted',
    });
  });
  it('requires both embeddings and structured output on a local provider', () => {
    expect(groundedAvailability(status('local', { embeddings: false }))).toEqual({
      available: false,
      reason: 'missing-capability',
    });
    expect(groundedAvailability(status('local', { structuredOutput: false }))).toEqual({
      available: false,
      reason: 'missing-capability',
    });
    expect(groundedAvailability(status('local'))).toEqual({ available: true });
  });
});

describe('grounded question bounds', () => {
  it('accepts up to 480 UTF8 bytes and rejects blank or malformed text', () => {
    expect(validGroundedQuestion('a'.repeat(480))).toBe(true);
    expect(validGroundedQuestion('a'.repeat(481))).toBe(false);
    expect(validGroundedQuestion('😀'.repeat(120))).toBe(true);
    expect(validGroundedQuestion('😀'.repeat(121))).toBe(false);
    expect(validGroundedQuestion('   ')).toBe(false);
    expect(validGroundedQuestion('bad \ud800 surrogate')).toBe(false);
    expect(validGroundedQuestion('bad \udc00 surrogate')).toBe(false);
  });
});

describe('eligible tasks', () => {
  it('requires an active assigned agent with read, draft and knowledge permissions', () => {
    expect(groundedEligibleTasks([task()], [agent()])).toHaveLength(1);
    expect(groundedEligibleTasks([task()], [agent({ status: 'paused' })])).toHaveLength(0);
    expect(
      groundedEligibleTasks([task()], [agent({ permissions: ['task.read', 'artifact.draft'] })]),
    ).toHaveLength(0);
    expect(groundedEligibleTasks([task({ assigneeType: 'human' } as never)], [agent()])).toEqual(
      [],
    );
    expect(groundedEligibleTasks([task({ assigneeAgent: 'other' })], [agent()])).toEqual([]);
  });
  it('requires project read only for project-scoped questions', () => {
    expect(agentCanAskKnowledge(agent(), true)).toBe(false);
    expect(
      agentCanAskKnowledge(
        agent({ permissions: ['task.read', 'artifact.draft', 'knowledge.read', 'project.read'] }),
        true,
      ),
    ).toBe(true);
    expect(agentCanAskKnowledge(undefined)).toBe(false);
  });
});

describe('parseGroundedRun', () => {
  it('parses a valid draft and marks cited excerpts', () => {
    const second = excerpt({ key: 'K2', start: 0, end: 17, quote: content.slice(0, 17) });
    const report = parseGroundedRun(run(knowledge([excerpt(), second])));
    expect(report).toMatchObject({
      question: 'When do we confirm backups?',
      answer: 'Before every release [K1].',
      projectScoped: false,
    });
    expect(report?.excerpts.map((item) => [item.key, item.cited])).toEqual([
      ['K1', true],
      ['K2', false],
    ]);
  });
  it.each([
    ['another workflow', run(knowledge(), 'research')],
    ['missing knowledge', run(undefined)],
    ['no excerpts', run(knowledge([]))],
    ['too many excerpts', run(knowledge([1, 2, 3, 4].map((n) => excerpt({ key: 'K' + n }))))],
    ['out-of-order key', run(knowledge([excerpt({ key: 'K2' })], ['K2']))],
    ['invalid source id', run(knowledge([excerpt({ sourceId: '../evil' })]))],
    ['quote length mismatch', run(knowledge([excerpt({ quote: 'invented' })]))],
    ['oversized quote', run(knowledge([excerpt({ start: 0, end: 241, quote: 'x'.repeat(241) })]))],
    ['citation to a missing key', run(knowledge([excerpt()], ['K9']))],
    ['no citations', run(knowledge([excerpt()], []))],
    ['non-string citation', run(knowledge([excerpt()], [1]))],
  ])('returns null for %s', (_label, value) => {
    expect(parseGroundedRun(value)).toBeNull();
  });
  it('builds a citation the knowledge page verifies only against the same current source', () => {
    const [item] = parseGroundedRun(run(knowledge()))!.excerpts;
    const source: KnowledgeSource = {
      id: sourceId,
      title: 'Release notes',
      content,
      kind: 'note',
      project: null,
      version: 3,
      contentDigest: 'd'.repeat(64),
      createdAt: '',
      updatedAt: '',
    };
    expect(isCurrentKnowledgeCitation(source, citationToHit(item))).toBe(true);
    expect(isCurrentKnowledgeCitation({ ...source, version: 4 }, citationToHit(item))).toBe(false);
    expect(
      isCurrentKnowledgeCitation({ ...source, content: 'changed ' + content }, citationToHit(item)),
    ).toBe(false);
  });
});
