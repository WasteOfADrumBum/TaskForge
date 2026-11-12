// Pure offline replay of hosted keyword and local semantic ranking over the frozen corpus, used
// by unit tests to pin the evaluation baseline. The integration suite runs the same questions
// through the real MongoDB-backed services and must reproduce these outcomes.
import { chunkKnowledge } from '../services/knowledgeIndexService/primitives';
import { knowledgeDigest, matchKnowledgeSources } from '../services/knowledgeService/primitives';
import { KNOWLEDGE_HIT_MAX, KNOWLEDGE_SCORE_MIN } from '../services/groundedKnowledgeService';
import {
  EVALUATION_CORPUS,
  EVALUATION_QUESTIONS,
  lexicalFixtureVector,
  uniqueRanked,
  type EvaluationOutcome,
} from './knowledgeEvaluation';

const OWNER = 'a'.repeat(24);
const idFor = (index: number) => (index + 1).toString(16).padStart(24, '0');
const corpus = EVALUATION_CORPUS.map((source, index) => {
  const input = {
    title: source.title,
    content: source.content,
    kind: 'note' as const,
    project: null,
  };
  return {
    slug: source.slug,
    id: idFor(index),
    owner: OWNER,
    ...input,
    version: 1,
    contentDigest: knowledgeDigest(input),
    deleted: false,
  };
});
const slugFor = (id: string) => corpus.find((source) => source.id === id)!.slug;

export const offlineKeywordOutcomes = (): EvaluationOutcome[] =>
  EVALUATION_QUESTIONS.map((question) => ({
    id: question.id,
    ranked: uniqueRanked(
      matchKnowledgeSources(OWNER, question.keywords, corpus).map((hit) => slugFor(hit.sourceId)),
    ),
  }));

const cosine = (left: number[], right: number[]) => {
  const a = Math.hypot(...left);
  const b = Math.hypot(...right);
  return left.reduce((sum, value, index) => sum + (value / a) * (right[index] / b), 0);
};
const chunks = corpus.flatMap((source) =>
  chunkKnowledge(source.content).map((chunk) => ({
    slug: source.slug,
    id: source.id,
    start: chunk.start,
    vector: lexicalFixtureVector(source.content.slice(chunk.start, chunk.end)),
  })),
);
export const offlineSemanticRank = (question: string) => {
  const query = lexicalFixtureVector(question);
  const ranked = chunks
    .map((chunk) => ({ ...chunk, score: cosine(query, chunk.vector) }))
    .filter((chunk) => Number.isFinite(chunk.score) && chunk.score >= KNOWLEDGE_SCORE_MIN)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id) || a.start - b.start)
    .slice(0, KNOWLEDGE_HIT_MAX);
  return uniqueRanked(ranked.map((chunk) => chunk.slug));
};
export const offlineSemanticOutcomes = (): EvaluationOutcome[] =>
  EVALUATION_QUESTIONS.map((question) => ({
    id: question.id,
    ranked: offlineSemanticRank(question.question),
  }));
