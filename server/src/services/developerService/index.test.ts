import {
  buildDemoDeveloperPlan,
  developerSchema,
  executeDeveloper,
  formatDeveloperOutput,
} from './index';
import { resolveConfiguredProvider, type AIProvider } from '../../ai/provider';
const good = {
  summary: 'Implement a double function',
  plan: ['Validate numeric input', 'Return value * 2'],
  codeSuggestion: 'function double(value: number) { return value * 2; }',
  checks: ['Check zero and negative numbers'],
  limitations: ['Not executed or applied'],
};
it('accepts a bounded technical plan or an explicit no-code plan', () => {
  expect(developerSchema.validate(good)).toBe(true);
  expect(developerSchema.validate({ ...good, codeSuggestion: '' })).toBe(true);
});
it.each([
  null,
  [],
  {},
  { ...good, tools: ['shell.execute'] },
  { ...good, owner: 'foreign' },
  { ...good, summary: '' },
  { ...good, summary: 'x'.repeat(601) },
  { ...good, plan: [] },
  { ...good, plan: [' '] },
  { ...good, plan: Array(5).fill('step') },
  { ...good, codeSuggestion: null },
  { ...good, codeSuggestion: 'x'.repeat(4001) },
  { ...good, checks: [] },
  { ...good, checks: ['x'.repeat(601)] },
  { ...good, limitations: [] },
  { ...good, limitations: [{ message: 'unknown' }] },
])('rejects malformed or tool-bearing plans %#', (value) =>
  expect(developerSchema.validate(value)).toBe(false),
);
it('renders unexecuted code and proposed checks as clearly advisory text', () => {
  const result = formatDeveloperOutput(good);
  expect(result).toContain('text only; unexecuted/unverified');
  expect(result).toContain('Proposed checks (not run)');
  expect(result).toContain('no repository or task changes');
});
it('simulation is explicitly labelled and makes no network call', async () => {
  const network = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No network'));
  try {
    const result = await executeDeveloper(
      resolveConfiguredProvider({ mode: 'demo' }),
      [{ role: 'user', content: 'Suggest a plan' }],
      {},
    );
    expect(result.value).toEqual(buildDemoDeveloperPlan());
    expect(result.simulation).toBe(true);
    expect(network).not.toHaveBeenCalled();
  } finally {
    network.mockRestore();
  }
});
it('consumer revalidates a local adapter that bypasses schema validation', async () => {
  const provider = {
    id: 'ollama',
    capabilities: { structuredOutput: true },
    structuredOutput: async () => ({
      value: { ...good, tools: ['shell'] },
      provider: 'ollama',
      simulation: false,
      label: 'Local',
    }),
  } as unknown as AIProvider;
  await expect(
    executeDeveloper(provider, [{ role: 'user', content: 'Draft' }], {}),
  ).rejects.toMatchObject({ code: 'INVALID_OUTPUT' });
});
