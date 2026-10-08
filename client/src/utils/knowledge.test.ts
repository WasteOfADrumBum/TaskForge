import { describe, expect, it } from 'vitest';
import {
  isCurrentKnowledgeCitation,
  utf8Bytes,
  validKnowledgeInput,
  validKnowledgeQuery,
} from './knowledge';
import type { KnowledgeSource, KnowledgeHit } from '../types/knowledge';
const source: KnowledgeSource = {
  id: 's1',
  title: 'Notes',
  content: 'a 😀quoted text',
  kind: 'note',
  project: null,
  version: 2,
  contentDigest: 'a'.repeat(64),
  createdAt: '',
  updatedAt: '',
};
const hit: KnowledgeHit = {
  sourceId: 's1',
  title: 'Notes',
  version: 2,
  contentDigest: source.contentDigest,
  score: 1,
  matchedInContent: true,
  citation: { field: 'content', start: 2, end: 4, quote: '😀' },
};
describe('bounded knowledge input and source provenance', () => {
  it('counts UTF8 bytes and refuses nonempty over-limit documents', () => {
    expect(utf8Bytes('😀')).toBe(4);
    expect(validKnowledgeInput({ ...source, content: '😀'.repeat(5000) })).toBe(true);
    expect(validKnowledgeInput({ ...source, content: '😀'.repeat(5001) })).toBe(false);
    expect(validKnowledgeInput({ ...source, title: ' ' })).toBe(false);
  });
  it('bounds query bytes and terms without interpreting regex', () => {
    expect(validKnowledgeQuery('literal [a-z]+')).toBe(true);
    expect(validKnowledgeQuery('😀'.repeat(31))).toBe(false);
    expect(validKnowledgeQuery('one '.repeat(9))).toBe(false);
    expect(validKnowledgeQuery(' ')).toBe(false);
  });
  it('verifies exact Unicode source offsets on current version', () =>
    expect(isCurrentKnowledgeCitation(source, hit)).toBe(true));
  it.each([
    { ...hit, sourceId: 'foreign' },
    { ...hit, version: 1 },
    { ...hit, contentDigest: 'b'.repeat(64) },
    { ...hit, citation: { ...hit.citation, quote: 'fabricated' } },
    { ...hit, citation: { ...hit.citation, start: -1 } },
    { ...hit, citation: { ...hit.citation, end: 1 } },
    { ...hit, citation: { ...hit.citation, start: 2.5 } },
    { ...hit, citation: { ...hit.citation, end: 999 } },
  ])('rejects invalid or stale citations %#', (value) =>
    expect(isCurrentKnowledgeCitation(source, value)).toBe(false),
  );
});
