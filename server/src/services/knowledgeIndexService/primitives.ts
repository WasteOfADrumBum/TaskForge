import { createHash } from 'node:crypto';
import {
  PINNED_EMBEDDING,
  validateEmbeddingVectors,
  type EmbeddingIdentity,
} from '../../ai/embedding';
import {
  KNOWLEDGE_CONTENT_MAX_BYTES,
  isWellFormedKnowledgeText,
} from '../knowledgeService/primitives';
export const KNOWLEDGE_CHUNK_MAX_BYTES = 480;
export const KNOWLEDGE_CHUNK_MAX = 48;
export interface KnowledgeChunk {
  start: number;
  end: number;
  digest: string;
}
export interface KnowledgeIndex {
  sourceId: string;
  sourceVersion: number;
  sourceDigest: string;
  identity: Readonly<EmbeddingIdentity>;
  indexedAt: Date;
  chunks: (KnowledgeChunk & { vector: number[] })[];
}
export const chunkDigest = (text: string) => createHash('sha256').update(text).digest('hex');
export const chunkKnowledge = (content: string): KnowledgeChunk[] => {
  if (
    typeof content !== 'string' ||
    !isWellFormedKnowledgeText(content) ||
    !content.trim() ||
    Buffer.byteLength(content, 'utf8') > KNOWLEDGE_CONTENT_MAX_BYTES
  )
    throw new Error('Invalid knowledge chunk input');
  const chunks: KnowledgeChunk[] = [];
  let start = 0;
  let offset = 0;
  let bytes = 0;
  const append = () => {
    const text = content.slice(start, offset);
    if (text.trim()) chunks.push({ start, end: offset, digest: chunkDigest(text) });
  };
  // Iterate code points so no surrogate pair is split; offsets remain exact UTF16 source offsets.
  for (const character of content) {
    const size = Buffer.byteLength(character, 'utf8');
    if (bytes + size > KNOWLEDGE_CHUNK_MAX_BYTES) {
      append();
      start = offset;
      bytes = 0;
    }
    offset += character.length;
    bytes += size;
  }
  append();
  if (!chunks.length || chunks.length > KNOWLEDGE_CHUNK_MAX)
    throw new Error('Excessive knowledge chunks');
  return chunks;
};
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const only = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key));
export const validKnowledgeIndex = (value: unknown): value is KnowledgeIndex => {
  if (
    !record(value) ||
    !only(value, [
      'sourceId',
      'sourceVersion',
      'sourceDigest',
      'identity',
      'indexedAt',
      'chunks',
    ]) ||
    typeof value.sourceId !== 'string' ||
    !/^[a-f0-9]{24}$/.test(value.sourceId) ||
    !Number.isSafeInteger(value.sourceVersion) ||
    (value.sourceVersion as number) < 1 ||
    (value.sourceVersion as number) > 100 ||
    typeof value.sourceDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.sourceDigest) ||
    !(value.indexedAt instanceof Date) ||
    !Number.isFinite(value.indexedAt.getTime()) ||
    !record(value.identity) ||
    !only(value.identity, ['model', 'digest', 'dimensions']) ||
    value.identity.model !== PINNED_EMBEDDING.model ||
    value.identity.digest !== PINNED_EMBEDDING.digest ||
    value.identity.dimensions !== PINNED_EMBEDDING.dimensions ||
    !Array.isArray(value.chunks) ||
    !value.chunks.length ||
    value.chunks.length > KNOWLEDGE_CHUNK_MAX
  )
    return false;
  let end = 0;
  return value.chunks.every((chunk) => {
    if (
      !record(chunk) ||
      !only(chunk, ['start', 'end', 'digest', 'vector']) ||
      !Number.isSafeInteger(chunk.start) ||
      !Number.isSafeInteger(chunk.end) ||
      (chunk.start as number) < end ||
      (chunk.end as number) <= (chunk.start as number) ||
      (chunk.end as number) > KNOWLEDGE_CONTENT_MAX_BYTES ||
      (chunk.end as number) - (chunk.start as number) > KNOWLEDGE_CHUNK_MAX_BYTES ||
      typeof chunk.digest !== 'string' ||
      !/^[a-f0-9]{64}$/.test(chunk.digest) ||
      !validateEmbeddingVectors([chunk.vector], 1, PINNED_EMBEDDING)
    )
      return false;
    end = chunk.end as number;
    return true;
  });
};
export const matchesKnowledgeIndex = (
  index: unknown,
  source: { id: string; version: number; contentDigest: string; content: string },
) => {
  if (
    !validKnowledgeIndex(index) ||
    index.sourceId !== source.id ||
    index.sourceVersion !== source.version ||
    index.sourceDigest !== source.contentDigest
  )
    return false;
  const chunks = chunkKnowledge(source.content);
  return (
    chunks.length === index.chunks.length &&
    chunks.every(
      (chunk, i) =>
        chunk.start === index.chunks[i].start &&
        chunk.end === index.chunks[i].end &&
        chunk.digest === index.chunks[i].digest,
    )
  );
};
