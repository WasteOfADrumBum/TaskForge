import { createHash } from 'node:crypto';
import { isObjectIdString } from '../../utils/objectId';
export const KNOWLEDGE_CONTENT_MAX_BYTES = 20000;
export const KNOWLEDGE_SOURCE_WINDOW = 50;
export const KNOWLEDGE_QUERY_MAX_BYTES = 120;
export const KNOWLEDGE_RESULT_MAX = 10;
export interface KnowledgeInput {
  title: string;
  content: string;
  kind: 'note' | 'text';
  project: string | null;
}
export class KnowledgeInputError extends Error {
  constructor() {
    super('Invalid or excessive knowledge input');
  }
}
export const normalizeKnowledgeInput = (value: unknown): KnowledgeInput => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new KnowledgeInputError();
  const body = value as Record<string, unknown>;
  if (
    Object.keys(body).some((key) => !['title', 'content', 'kind', 'project'].includes(key)) ||
    typeof body.title !== 'string' ||
    !body.title.trim() ||
    body.title.length > 120 ||
    typeof body.content !== 'string' ||
    !body.content.trim() ||
    Buffer.byteLength(body.content, 'utf8') > KNOWLEDGE_CONTENT_MAX_BYTES ||
    !['note', 'text'].includes(body.kind as string) ||
    !(body.project === undefined || body.project === null || isObjectIdString(body.project))
  )
    throw new KnowledgeInputError();
  return {
    title: body.title.trim(),
    content: body.content,
    kind: body.kind as KnowledgeInput['kind'],
    project: typeof body.project === 'string' ? body.project.toLowerCase() : null,
  };
};
export const knowledgeDigest = (input: KnowledgeInput) =>
  createHash('sha256')
    .update(JSON.stringify([input.title, input.content, input.kind, input.project]))
    .digest('hex');
export const parseKnowledgeQuery = (value: unknown): string[] => {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    Buffer.byteLength(value, 'utf8') > KNOWLEDGE_QUERY_MAX_BYTES
  )
    throw new KnowledgeInputError();
  const terms = [
    ...new Set(
      value
        .trim()
        .split(/\s+/u)
        .map((term) => term.toLowerCase()),
    ),
  ];
  if (terms.length > 8) throw new KnowledgeInputError();
  return terms;
};
export interface KeywordSource extends KnowledgeInput {
  id: string;
  owner: string;
  version: number;
  contentDigest: string;
  deleted?: boolean;
}
const literal = (term: string) => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu');
// This pure helper never fetches records. The future service must also scope its DB query to owner.
export const matchKnowledgeSources = (
  owner: string,
  query: unknown,
  candidates: readonly KeywordSource[],
) => {
  if (!isObjectIdString(owner) || candidates.length > KNOWLEDGE_SOURCE_WINDOW)
    throw new KnowledgeInputError();
  const terms = parseKnowledgeQuery(query).map(literal);
  return candidates
    .filter((source) => source.owner.toLowerCase() === owner.toLowerCase() && !source.deleted)
    .map((source) => {
      const input = normalizeKnowledgeInput({
        title: source.title,
        content: source.content,
        kind: source.kind,
        project: source.project,
      });
      if (
        !isObjectIdString(source.id) ||
        !Number.isSafeInteger(source.version) ||
        source.version < 1 ||
        knowledgeDigest(input) !== source.contentDigest
      )
        throw new KnowledgeInputError();
      let score = 0;
      let offset: number | undefined;
      for (const term of terms) {
        if (term.test(source.title)) score += 2;
        const match = term.exec(source.content);
        if (match) {
          score++;
          offset ??= match.index;
        }
      }
      if (!score) return null;
      const start = Math.max(0, (offset ?? 0) - 60);
      const end = Math.min(source.content.length, start + 240);
      return {
        sourceId: source.id,
        title: source.title,
        version: source.version,
        contentDigest: source.contentDigest,
        score,
        citation: {
          field: 'content' as const,
          start,
          end,
          quote: source.content.slice(start, end),
        },
        matchedInContent: offset !== undefined,
      };
    })
    .filter((result) => result !== null)
    .sort((a, b) => b.score - a.score || a.sourceId.localeCompare(b.sourceId))
    .slice(0, KNOWLEDGE_RESULT_MAX);
};
