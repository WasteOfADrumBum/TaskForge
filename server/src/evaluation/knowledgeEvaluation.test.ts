import {
  EVALUATION_CORPUS,
  EVALUATION_QUESTIONS,
  evaluationTokens,
  lexicalFixtureVector,
  scoreEvaluation,
} from './knowledgeEvaluation';
import { offlineKeywordOutcomes, offlineSemanticOutcomes, offlineSemanticRank } from './offline';
import { KEYWORD_BASELINE, SEMANTIC_FIXTURE_BASELINE } from './baseline';
import { parseKnowledgeQuery } from '../services/knowledgeService/primitives';
import { validKnowledgeQuestion } from '../services/groundedKnowledgeService';
import { chunkKnowledge } from '../services/knowledgeIndexService/primitives';

describe('frozen evaluation corpus', () => {
  it('stays within product bounds and has unique identities', () => {
    expect(new Set(EVALUATION_CORPUS.map((source) => source.slug)).size).toBe(
      EVALUATION_CORPUS.length,
    );
    expect(new Set(EVALUATION_QUESTIONS.map((question) => question.id)).size).toBe(
      EVALUATION_QUESTIONS.length,
    );
    for (const source of EVALUATION_CORPUS) {
      expect(source.title.length).toBeLessThanOrEqual(120);
      expect(chunkKnowledge(source.content).length).toBeGreaterThan(0);
    }
    for (const question of EVALUATION_QUESTIONS) {
      expect(validKnowledgeQuestion(question.question)).toBe(true);
      expect(() => parseKnowledgeQuery(question.keywords)).not.toThrow();
      for (const slug of question.relevant)
        expect(EVALUATION_CORPUS.some((source) => source.slug === slug)).toBe(true);
    }
    expect(EVALUATION_QUESTIONS.filter((question) => !question.relevant.length)).toHaveLength(3);
  });
  it('builds deterministic nonzero fixture vectors of the pinned dimension', () => {
    const vector = lexicalFixtureVector('The the AND of');
    expect(vector).toHaveLength(384);
    expect(Math.hypot(...vector)).toBeGreaterThan(0);
    expect(lexicalFixtureVector('Backups kept nightly')).toEqual(
      lexicalFixtureVector('backups KEPT nightly'),
    );
    expect(evaluationTokens('Backups are kept')).toEqual(['backup', 'kept']);
  });
});

describe('metrics', () => {
  it('scores hits, reciprocal rank and abstention', () => {
    const questions = [
      { id: 'a', question: 'x', keywords: 'x', relevant: ['one'] },
      { id: 'b', question: 'y', keywords: 'y', relevant: ['two'] },
      { id: 'c', question: 'z', keywords: 'z', relevant: [] },
      { id: 'd', question: 'w', keywords: 'w', relevant: [] },
    ];
    expect(
      scoreEvaluation(
        [
          { id: 'a', ranked: ['one'] },
          { id: 'b', ranked: ['one', 'three', 'two'] },
          { id: 'c', ranked: [] },
          { id: 'd', ranked: ['one'] },
        ],
        questions,
      ),
    ).toMatchObject({
      hitAt1: 0.5,
      hitAt3: 1,
      meanReciprocalRank: 0.667,
      abstentionRate: 0.5,
      falseAnswerRate: 0.5,
    });
  });
  it('rejects missing or duplicate outcomes', () => {
    expect(() => scoreEvaluation([])).toThrow('exactly one outcome');
  });
});

describe('offline baseline', () => {
  it('hosted keyword search finds every answerable source first and abstains on the rest', () => {
    const outcomes = offlineKeywordOutcomes();
    expect(Object.fromEntries(outcomes.map((o) => [o.id, o.ranked]))).toEqual(KEYWORD_BASELINE);
    expect(scoreEvaluation(outcomes)).toEqual({
      corpus: 'kan50-v1',
      answerable: 10,
      unanswerable: 3,
      hitAt1: 1,
      hitAt3: 1,
      meanReciprocalRank: 1,
      abstentionRate: 1,
      falseAnswerRate: 0,
    });
  });
  it('semantic pipeline with lexical fixture vectors abstains instead of guessing on weak matches', () => {
    const outcomes = offlineSemanticOutcomes();
    expect(Object.fromEntries(outcomes.map((o) => [o.id, o.ranked]))).toEqual(
      SEMANTIC_FIXTURE_BASELINE,
    );
    expect(scoreEvaluation(outcomes)).toMatchObject({
      hitAt1: 0.8,
      hitAt3: 0.8,
      meanReciprocalRank: 0.8,
      abstentionRate: 1,
      falseAnswerRate: 0,
    });
  });
  it('retrieves the prompt-injection fixture for the integration safety question', () => {
    expect(
      offlineSemanticRank('What does the untrusted vendor note ask to approve automatically?'),
    ).toContain('vendor-injection');
  });
});
