// Matches the owned KnowledgeSource API; list responses intentionally omit content.
export interface KnowledgeInput {
  title: string;
  content: string;
  kind: 'note' | 'text';
  project: string | null;
}
export interface KnowledgeSummary extends Omit<KnowledgeInput, 'content'> {
  id: string;
  version: number;
  contentDigest: string;
  createdAt: string;
  updatedAt: string;
}
export interface KnowledgeSource extends KnowledgeSummary {
  content: string;
}
export interface KnowledgeHit {
  sourceId: string;
  title: string;
  version: number;
  contentDigest: string;
  score: number;
  matchedInContent: boolean;
  citation: { field: 'content'; start: number; end: number; quote: string };
}
export interface KnowledgeSearch {
  mode: 'keyword';
  modelUsed: false;
  results: KnowledgeHit[];
}
