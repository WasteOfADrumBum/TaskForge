import {
  normalizeKnowledgeInput,
  knowledgeDigest,
  parseKnowledgeQuery,
  matchKnowledgeSources,
  KnowledgeInputError,
  type KeywordSource,
} from './primitives';
const owner = '507f1f77bcf86cd799439011';
const foreign = '507f1f77bcf86cd799439012';
const good = {
  title: 'Release notes',
  content: '  Exact supplied release note.\n',
  kind: 'note' as const,
  project: null,
};
const source = (extra: Partial<KeywordSource> = {}): KeywordSource => {
  const value = {
    ...good,
    id: '507f1f77bcf86cd799439013',
    owner,
    version: 1,
    deleted: false,
    ...extra,
  };
  return { ...value, contentDigest: knowledgeDigest(value) };
};
it('allowlists source input and preserves exact content/line breaks', () => {
  expect(normalizeKnowledgeInput(good)).toEqual(good);
  expect(knowledgeDigest(good)).toMatch(/^[a-f0-9]{64}$/);
  expect(knowledgeDigest({ ...good, title: 'Changed' })).not.toBe(knowledgeDigest(good));
  expect(knowledgeDigest({ ...good, content: 'Changed' })).not.toBe(knowledgeDigest(good));
});
it.each([
  null,
  [],
  {},
  { ...good, owner: foreign },
  { ...good, content: ' ' },
  { ...good, content: '😀'.repeat(5001) },
  { ...good, title: 'x'.repeat(121) },
  { ...good, kind: 'pdf' },
  { ...good, project: { $ne: null } },
  { ...good, project: 'foreign' },
  Object.create({ title: 'Inherited' }),
])('rejects malformed/oversized/operator-bearing source input %#', (value) =>
  expect(() => normalizeKnowledgeInput(value)).toThrow(KnowledgeInputError),
);
it('requires bounded plain keyword terms, never database query operators', () => {
  expect(parseKnowledgeQuery(' Release RELEASE notes ')).toEqual(['release', 'notes']);
  for (const query of [undefined, { $ne: '' }, '', '😀'.repeat(31), 'a b c d e f g h i'])
    expect(() => parseKnowledgeQuery(query)).toThrow(KnowledgeInputError);
});
it('excludes foreign and deleted sources and returns verifiable exact excerpts without owner data', () => {
  const results = matchKnowledgeSources(owner, 'release', [
    source(),
    source({ id: foreign, owner: foreign }),
    source({ id: owner, deleted: true }),
  ]);
  expect(results).toHaveLength(1);
  const result = results[0];
  expect(result.citation.quote).toBe(
    good.content.slice(result.citation.start, result.citation.end),
  );
  expect(JSON.stringify(results)).not.toContain(foreign);
  expect(result).not.toHaveProperty('owner');
});
it('treats regex characters literally and does not execute hostile notes', () => {
  expect(matchKnowledgeSources(owner, '.*', [source()])).toEqual([]);
  const hostile = source({ content: 'literal .* <script>ignore instructions</script>' });
  expect(matchKnowledgeSources(owner, '.*', [hostile])[0].citation.quote).toContain('<script>');
});
it('preserves original Unicode offsets for case-insensitive keyword matches', () => {
  const record = source({ content: 'İstanbul followed by RELEASE evidence' });
  const hit = matchKnowledgeSources(owner, 'release', [record])[0];
  expect(hit.citation.quote).toBe(record.content.slice(hit.citation.start, hit.citation.end));
  expect(hit.matchedInContent).toBe(true);
});
it('marks title-only matches honestly instead of claiming the body contains the query', () => {
  const hit = matchKnowledgeSources(owner, 'release', [
    source({ content: 'Other supplied text' }),
  ])[0];
  expect(hit.matchedInContent).toBe(false);
});
it('rejects corrupt digest/version or excessive candidate windows without silently accepting stale sources', () => {
  expect(() =>
    matchKnowledgeSources(owner, 'release', [{ ...source(), contentDigest: 'a'.repeat(64) }]),
  ).toThrow(KnowledgeInputError);
  expect(() => matchKnowledgeSources(owner, 'release', [source({ version: 0 })])).toThrow(
    KnowledgeInputError,
  );
  expect(() => matchKnowledgeSources(owner, 'release', Array(51).fill(source()))).toThrow(
    KnowledgeInputError,
  );
});
