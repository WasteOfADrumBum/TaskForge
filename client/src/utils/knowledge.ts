import type { KnowledgeHit, KnowledgeInput, KnowledgeSource } from '../types/knowledge';
export const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;
export const validKnowledgeInput = (input: KnowledgeInput) =>
  !!input.title.trim() &&
  input.title.length <= 120 &&
  !!input.content.trim() &&
  utf8Bytes(input.content) <= 20000;
export const validKnowledgeQuery = (query: string) =>
  !!query.trim() && utf8Bytes(query) <= 120 && query.trim().split(/\s+/u).length <= 8;
// Citation provenance is checked against the loaded current owned source, never trusted router state.
export const isCurrentKnowledgeCitation = (source: KnowledgeSource, hit: KnowledgeHit) => {
  const citation = hit?.citation;
  return (
    hit?.sourceId === source.id &&
    hit.version === source.version &&
    hit.contentDigest === source.contentDigest &&
    citation?.field === 'content' &&
    Number.isInteger(citation.start) &&
    Number.isInteger(citation.end) &&
    citation.start >= 0 &&
    citation.end > citation.start &&
    citation.end <= source.content.length &&
    citation.end - citation.start <= 240 &&
    typeof citation.quote === 'string' &&
    source.content.slice(citation.start, citation.end) === citation.quote
  );
};
