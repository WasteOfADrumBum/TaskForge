import {
  normalizeResearchSources,
  suppliedSourceId,
  ResearchSourceError,
  makeResearchSchema,
  buildDemoResearch,
  executeResearch,
  formatResearchOutput,
} from './index';
import { resolveConfiguredProvider } from '../../ai/provider';
import type { RunContextSnapshot } from '../contextService';
const excerpt = {
  title: 'Release notes',
  text: 'A supplied note says tests passed.',
  referenceUrl: 'https://example.test/notes',
};
const snapshot: RunContextSnapshot = {
  schemaVersion: 1,
  untrusted: true,
  sources: [
    {
      kind: 'supplied',
      id: suppliedSourceId(excerpt),
      title: excerpt.title,
      description: excerpt.text,
      referenceUrl: excerpt.referenceUrl,
      supplied: true,
      updatedAt: '2026-10-08T00:00:00.000Z',
    },
  ],
};
it('clones allowlisted text without retrieval and preserves quote whitespace', () => {
  const input = { ...excerpt, text: '  quoted text\n' };
  const result = normalizeResearchSources([input]);
  input.text = 'changed';
  expect(result[0].text).toBe('  quoted text\n');
  expect(suppliedSourceId(result[0])).toMatch(/^[a-f0-9]{64}$/);
  expect(normalizeResearchSources(undefined)).toEqual([]);
});
it.each([
  null,
  {},
  ['text'],
  [{ title: 'x' }],
  [{ title: '', text: 'x' }],
  [{ title: 'x', text: ' ' }],
  [{ title: 'x', text: 'x'.repeat(4001) }],
  [{ ...excerpt, owner: 'foreign' }],
  [{ ...excerpt, referenceUrl: 'file:///private' }],
  [{ ...excerpt, referenceUrl: 'https://user:password@example.test' }],
  [{ ...excerpt, referenceUrl: 'javascript:alert(1)' }],
  [excerpt, excerpt],
  [excerpt, excerpt, excerpt, excerpt],
])('rejects malformed, excessive and unsupported supplied sources %#', (value) => {
  expect(() => normalizeResearchSources(value)).toThrow(ResearchSourceError);
});
it('requires exact captured quotations and source IDs while labelling interpretation', () => {
  const report = buildDemoResearch(snapshot);
  const schema = makeResearchSchema(snapshot);
  expect(schema.validate(report)).toBe(true);
  expect(
    schema.validate({ ...report, evidence: [{ ...report.evidence[0], quote: 'Invented claim' }] }),
  ).toBe(false);
  expect(
    schema.validate({
      ...report,
      evidence: [{ ...report.evidence[0], sourceId: 'supplied:foreign' }],
    }),
  ).toBe(false);
  expect(
    schema.validate({ ...report, evidence: [{ ...report.evidence[0], tools: ['fetch'] }] }),
  ).toBe(false);
  expect(
    schema.validate({
      ...report,
      inferences: [{ statement: 'Inference', basedOnSourceIds: ['supplied:foreign'] }],
    }),
  ).toBe(false);
  expect(
    schema.validate({
      ...report,
      inferences: [
        {
          statement: 'Inference',
          basedOnSourceIds: [report.evidence[0].sourceId, report.evidence[0].sourceId],
        },
      ],
    }),
  ).toBe(false);
  expect(schema.validate({ ...report, limitations: [] })).toBe(false);
  expect(schema.validate({ ...report, owner: 'private' })).toBe(false);
  const formatted = formatResearchOutput(report, snapshot);
  expect(formatted).toContain('Interpretation:');
  expect(formatted).toContain('not fetched');
});
it('simulation produces validated evidence without a network request', async () => {
  const network = jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('No network permitted'));
  try {
    const result = await executeResearch(
      resolveConfiguredProvider({ mode: 'demo' }),
      snapshot,
      [{ role: 'user', content: 'Summarize supplied notes' }],
      {},
    );
    expect(result.simulation).toBe(true);
    expect(makeResearchSchema(snapshot).validate(result.value)).toBe(true);
    expect(network).not.toHaveBeenCalled();
  } finally {
    network.mockRestore();
  }
});

it('simulation quotes nonblank text after long leading whitespace without inventing content', () => {
  const padded = {
    ...snapshot,
    sources: [{ ...snapshot.sources[0], description: ' '.repeat(300) + 'Quoted note' }],
  };
  const report = buildDemoResearch(padded);
  expect(report.evidence[0].quote).toBe('Quoted note');
  expect(makeResearchSchema(padded).validate(report)).toBe(true);
});

it('constrains native quotation generation to captured bounded nonblank excerpts, never invented wording', () => {
  expect(makeResearchSchema(snapshot).jsonSchema).toMatchObject({
    properties: {
      evidence: { items: { properties: { quote: { enum: [excerpt.text], maxLength: 400 } } } },
    },
  });
});
