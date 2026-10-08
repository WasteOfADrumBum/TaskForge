import { buildDemoTriage, executeTriage, formatTriageOutput, makeTriageSchema } from './index';
import type { RunContextSnapshot } from '../contextService';
import type { AIProvider } from '../../ai/provider';
const taskId = '507f1f77bcf86cd799439011';
const agentId = '507f1f77bcf86cd799439012';
const otherAgent = '507f1f77bcf86cd799439013';
const good: import('./index').TriageRecommendation = {
  summary: 'Review this proposal',
  proposal: { taskId, agentId, priority: 'medium', reason: 'Captured task needs these skills' },
};
const snapshot = (description = 'Task notes', skills = ['research']): RunContextSnapshot => ({
  schemaVersion: 1,
  untrusted: true,
  sources: [
    {
      kind: 'task',
      id: taskId,
      updatedAt: '2026-01-01Z',
      title: 'Task',
      description,
      priority: 'medium',
      status: 'todo',
    },
    {
      kind: 'agent',
      id: agentId,
      updatedAt: '2026-01-01Z',
      name: 'Candidate',
      description: '',
      role: 'Researcher',
      skills,
    },
  ],
});
it.each(['low', 'medium', 'high'])('accepts exact captured proposal priority %s', (priority) => {
  expect(
    makeTriageSchema(taskId, [agentId]).validate({
      ...good,
      proposal: { ...good.proposal, priority },
    }),
  ).toBe(true);
});
it('accepts explicit no-agent suggestion when roster is empty', () => {
  const schema = makeTriageSchema(taskId, []);
  expect(schema.validate({ ...good, proposal: { ...good.proposal, agentId: null } })).toBe(true);
  expect(schema.validate(good)).toBe(false);
});
it.each([
  null,
  [],
  {},
  { ...good, owner: 'foreign' },
  { ...good, summary: '' },
  { ...good, summary: '   ' },
  { ...good, summary: 'x'.repeat(1001) },
  { ...good, proposal: null },
  { ...good, proposal: [] },
  { ...good, proposal: { ...good.proposal, taskId: otherAgent } },
  { ...good, proposal: { ...good.proposal, agentId: otherAgent } },
  { ...good, proposal: { ...good.proposal, priority: 'urgent' } },
  { ...good, proposal: { ...good.proposal, reason: '' } },
  { ...good, proposal: { ...good.proposal, reason: ' '.repeat(5) } },
  { ...good, proposal: { ...good.proposal, reason: 'x'.repeat(1001) } },
  { ...good, proposal: { ...good.proposal, tools: ['shell.execute'] } },
])('rejects nonexact/foreign/oversized proposal %s', (value) => {
  expect(makeTriageSchema(taskId, [agentId]).validate(value)).toBe(false);
});
it('publishes matching strict JSON schema with captured-ID enums', () => {
  expect(makeTriageSchema(taskId, [agentId]).jsonSchema).toMatchObject({
    additionalProperties: false,
    required: ['summary', 'proposal'],
    properties: {
      proposal: {
        additionalProperties: false,
        properties: {
          taskId: { enum: [taskId] },
          agentId: { enum: [agentId, null] },
          priority: { enum: ['low', 'medium', 'high'] },
        },
      },
    },
  });
});
it('keeps demo explicitly deterministic and proposes no unmatched agent', () => {
  const first = buildDemoTriage(snapshot());
  expect(buildDemoTriage(snapshot())).toEqual(first);
  expect(first).toMatchObject({ proposal: { taskId, agentId: null, priority: 'medium' } });
  expect(first.summary).toContain('No AI model was called');
});
it('uses captured skill matches and bounded urgency rules only', () => {
  expect(buildDemoTriage(snapshot('Urgent research task'))).toMatchObject({
    proposal: { taskId, agentId, priority: 'high' },
  });
  expect(buildDemoTriage(snapshot('Unblocked research task'))).toMatchObject({
    proposal: { priority: 'medium' },
  });
});
it('breaks matching-skill ties by captured ID independent of roster order', () => {
  const state = snapshot('Research task');
  state.sources.push({ ...state.sources[1], id: otherAgent });
  state.sources.reverse();
  expect(buildDemoTriage(state).proposal.agentId).toBe(agentId);
});
it('formats suggestion as advisory plain text without claiming task updates', () => {
  expect(formatTriageOutput(good, snapshot())).toContain('Suggested agent: Candidate');
  expect(formatTriageOutput({ ...good, proposal: { ...good.proposal, agentId: null } })).toContain(
    'No alternative proposed',
  );
  expect(formatTriageOutput(good)).toContain('no task changes are applied');
});
const provider = (id = 'ollama-local', value: unknown = good): AIProvider => ({
  id,
  capabilities: { chat: true, structuredOutput: true, embeddings: false },
  chat: jest.fn(),
  embed: jest.fn(),
  structuredOutput: jest.fn().mockResolvedValue({
    value,
    provider: id,
    simulation: id === 'demo',
    label: id === 'demo' ? 'Explicit simulation' : 'Local inference draft',
  }),
});
it('calls structured output with exact schema and forwards cancellation/deadline without chat fallback', async () => {
  const local = provider();
  const controller = new AbortController();
  const messages = [{ role: 'user' as const, content: 'Untrusted notes' }];
  const options = { signal: controller.signal, timeoutMs: 30000 };
  expect((await executeTriage(local, snapshot(), messages, options)).value).toEqual(good);
  expect(local.structuredOutput).toHaveBeenCalledWith(
    messages,
    expect.objectContaining({
      validate: expect.any(Function),
      jsonSchema: expect.objectContaining({ additionalProperties: false }),
    }),
    options,
  );
  expect(local.chat).not.toHaveBeenCalled();
});
it('fails closed when a local adapter returns a foreign proposal', async () => {
  const local = provider('ollama-local', {
    ...good,
    proposal: { ...good.proposal, agentId: otherAgent },
  });
  await expect(executeTriage(local, snapshot(), [], {})).rejects.toMatchObject({
    code: 'INVALID_OUTPUT',
  });
  expect(local.chat).not.toHaveBeenCalled();
});
it('requires structured output capability before any provider activity', async () => {
  const local = {
    ...provider(),
    capabilities: { chat: true, structuredOutput: false, embeddings: false },
  };
  await expect(executeTriage(local, snapshot(), [], {})).rejects.toMatchObject({
    code: 'UNSUPPORTED',
  });
  expect(local.structuredOutput).not.toHaveBeenCalled();
  expect(local.chat).not.toHaveBeenCalled();
});
it('labels demo rule output and still validates the canned provider call', async () => {
  const demo = provider('demo', { summary: 'Canned text', simulated: true });
  const result = await executeTriage(demo, snapshot('Blocked research task'), [], {});
  expect(result).toMatchObject({
    simulation: true,
    provider: 'demo',
    value: { proposal: { agentId, priority: 'high' } },
  });
  expect(result.label).toContain('Rule-based triage simulation');
  expect(demo.structuredOutput).toHaveBeenCalledTimes(1);
  const schema = jest.mocked(demo.structuredOutput).mock.calls[0][1];
  expect(schema.validate({ summary: 'Canned text', simulated: true })).toBe(true);
  expect(schema.validate({ summary: 'Canned text', simulated: true, tools: ['shell'] })).toBe(
    false,
  );
});
it.each([
  { summary: 'Canned', simulated: false },
  { summary: 'Canned', simulated: true, tools: ['shell.execute'] },
])('rejects malformed canned simulation from an injected provider %s', async (value) => {
  const demo = provider('demo', value);
  await expect(executeTriage(demo, snapshot(), [], {})).rejects.toMatchObject({
    code: 'INVALID_OUTPUT',
  });
  expect(demo.chat).not.toHaveBeenCalled();
});
