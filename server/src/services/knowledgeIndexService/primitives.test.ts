import {
  chunkKnowledge,
  chunkDigest,
  KNOWLEDGE_CHUNK_MAX,
  KNOWLEDGE_CHUNK_MAX_BYTES,
  matchesKnowledgeIndex,
  validKnowledgeIndex,
  type KnowledgeIndex,
} from './primitives';
import { PINNED_EMBEDDING } from '../../ai/embedding';
const vector = () => Array.from({ length: 384 }, (_, i) => (i === 0 ? 1 : 0));
const source = {
  id: '507f1f77bcf86cd799439011',
  version: 2,
  contentDigest: 'a'.repeat(64),
  content: 'Exact citation text',
};
const index = (): KnowledgeIndex => ({
  sourceId: source.id,
  sourceVersion: 2,
  sourceDigest: source.contentDigest,
  identity: PINNED_EMBEDDING,
  indexedAt: new Date(),
  chunks: chunkKnowledge(source.content).map((chunk) => ({ ...chunk, vector: vector() })),
});
it('chunks exact Unicode source offsets deterministically without splitting surrogates', () => {
  const text = '😀'.repeat(5000);
  const chunks = chunkKnowledge(text);
  expect(chunks.length).toBeLessThanOrEqual(KNOWLEDGE_CHUNK_MAX);
  expect(chunks.map((chunk) => text.slice(chunk.start, chunk.end)).join('')).toBe(text);
  for (const chunk of chunks) {
    const quote = text.slice(chunk.start, chunk.end);
    expect(Buffer.byteLength(quote, 'utf8')).toBeLessThanOrEqual(KNOWLEDGE_CHUNK_MAX_BYTES);
    expect(quote.startsWith('😀')).toBe(true);
    expect(quote.endsWith('😀')).toBe(true);
    expect(chunk.digest).toBe(chunkDigest(quote));
  }
  expect(chunkKnowledge(text)).toEqual(chunks);
});
it('skips whitespace-only chunks while preserving exact later positions', () => {
  const text = ' '.repeat(480) + 'literal body';
  expect(chunkKnowledge(text)).toEqual([
    { start: 480, end: text.length, digest: chunkDigest('literal body') },
  ]);
});
it.each(['', ' ', '\ud800', '😀'.repeat(5001)])('rejects invalid/oversized text %s', (text) =>
  expect(() => chunkKnowledge(text)).toThrow(),
);
it('verifies complete current chunk/model/vector provenance', () => {
  expect(validKnowledgeIndex(index())).toBe(true);
  expect(matchesKnowledgeIndex(index(), source)).toBe(true);
});
it.each([
  (value: KnowledgeIndex) => {
    value.sourceVersion++;
  },
  (value: KnowledgeIndex) => {
    value.sourceDigest = 'b'.repeat(64);
  },
  (value: KnowledgeIndex) => {
    value.chunks[0].digest = 'b'.repeat(64);
  },
  (value: KnowledgeIndex) => {
    value.chunks[0].start++;
  },
  (value: KnowledgeIndex) => {
    value.identity = { ...PINNED_EMBEDDING, digest: 'b'.repeat(64) };
  },
  (value: KnowledgeIndex) => {
    value.chunks[0].vector = Array(384).fill(NaN);
  },
])('rejects stale/altered/model-invalid provenance %#', (change) => {
  const value = index();
  change(value);
  expect(matchesKnowledgeIndex(value, source)).toBe(false);
});
it('rejects excessive chunk arrays/unknown persisted fields/overlap', () => {
  const value = index();
  expect(validKnowledgeIndex({ ...value, unknown: 'data' })).toBe(false);
  expect(validKnowledgeIndex({ ...value, chunks: Array(49).fill(value.chunks[0]) })).toBe(false);
  expect(validKnowledgeIndex({ ...value, chunks: [value.chunks[0], value.chunks[0]] })).toBe(false);
});
