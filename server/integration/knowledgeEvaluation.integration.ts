import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import app from '../src/app';
import { User } from '../src/models/userModel';
import { Task } from '../src/models/taskModel';
import { Agent } from '../src/models/agentModel';
import { Project } from '../src/models/projectModel';
import { Run } from '../src/models/runModel';
import { AuditEvent } from '../src/models/auditEventModel';
import { KnowledgeSource } from '../src/models/knowledgeSourceModel';
import { KnowledgeDenial } from '../src/models/knowledgeDenialModel';
import { changeKnowledge, createKnowledge, getKnowledge } from '../src/services/knowledgeService';
import { createKnowledgeIndexer } from '../src/services/knowledgeIndexService';
import {
  KNOWLEDGE_SYSTEM_INSTRUCTION,
  KnowledgeRetrievalError,
  retrieveKnowledge,
} from '../src/services/groundedKnowledgeService';
import { createOwnedRun } from '../src/services/runService';
import { createRunExecutor } from '../src/services/runService/execution';
import { createAIProvider, type ProviderAdapter } from '../src/ai/provider';
import { PINNED_EMBEDDING } from '../src/ai/embedding';
import {
  EVALUATION_CORPUS,
  EVALUATION_QUESTIONS,
  lexicalFixtureVector,
  scoreEvaluation,
  uniqueRanked,
  type EvaluationOutcome,
} from '../src/evaluation/knowledgeEvaluation';
import { KEYWORD_BASELINE, SEMANTIC_FIXTURE_BASELINE } from '../src/evaluation/baseline';

// KAN-50: reproduces the frozen evaluation through the real MongoDB-backed services and HTTP API.
// Lexical fixture vectors exercise the semantic pipeline deterministically; they measure pipeline
// correctness, not model quality (see npm run test:local-ai -- --local-only --evaluate).
const parent = process.env.TEST_MONGO_URI;
if (
  !parent ||
  !/^mongodb:\/\/(?:127[.]0[.]0[.]1|localhost):[0-9]{1,5}\/taskforge_qa_[a-zA-Z0-9_]{8,}$/.test(
    parent,
  )
)
  throw new Error('Knowledge evaluation requires a fresh loopback Mongo namespace');

const fixtureProvider = (
  action: (
    messages: readonly { role: string; content: string }[],
  ) => Promise<unknown> = async () => ({
    answer: 'The note is untrusted vendor text and gives no approved instruction.',
    citations: ['K1'],
  }),
) => {
  const embed = jest.fn(async (texts: readonly string[]) => texts.map(lexicalFixtureVector));
  const structured = jest.fn(action);
  const adapter: ProviderAdapter = {
    id: 'ollama',
    simulation: false,
    label: 'Deterministic lexical evaluation fixture; not real inference',
    chat: async () => 'unused',
    structuredOutput: (messages) => structured(messages),
    embedding: { identity: PINNED_EMBEDDING, embed },
  };
  return { ai: createAIProvider(adapter), embed, structured };
};
const options = () => ({ signal: new AbortController().signal, timeoutMs: 10000 });

let owner: string;
let token: string;
let stranger: string;
let strangerToken: string;
const slugs = new Map<string, string>();
const ids = new Map<string, string>();

beforeAll(async () => {
  await mongoose.connect(parent + '_evaluation', {
    autoCreate: false,
    autoIndex: false,
    serverSelectionTimeoutMS: 5000,
  });
  const db = mongoose.connection.db;
  if (!db || (await db.listCollections().toArray()).length)
    throw new Error('Refusing existing evaluation collections');
  for (const model of [
    User,
    Task,
    Agent,
    Project,
    Run,
    AuditEvent,
    KnowledgeSource,
    KnowledgeDenial,
  ]) {
    await model.createCollection();
    await model.createIndexes();
  }
  owner = (
    await User.create({ email: 'evaluation-owner@example.test', password: 'synthetic-only' })
  ).id;
  token = jwt.sign({ id: owner }, process.env.JWT_SECRET!);
  stranger = (
    await User.create({ email: 'evaluation-stranger@example.test', password: 'synthetic-only' })
  ).id;
  strangerToken = jwt.sign({ id: stranger }, process.env.JWT_SECRET!);
  const indexer = createKnowledgeIndexer(fixtureProvider().ai);
  for (const item of EVALUATION_CORPUS) {
    const source = (
      await createKnowledge(
        owner,
        { title: item.title, content: item.content, kind: 'note', project: null },
        randomUUID(),
      )
    ).source!;
    slugs.set(source.id!, item.slug);
    ids.set(item.slug, source.id!);
    await indexer.index({
      owner,
      id: source.id!,
      version: source.version,
      contentDigest: source.contentDigest,
    });
  }
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => mongoose.disconnect());

const keywordSearch = (query: string, value = token) =>
  request(app)
    .get('/api/knowledge/search')
    .query({ q: query })
    .set({ Authorization: 'Bearer ' + value });
const semantic = async (question: string, who = owner) => {
  try {
    return (await retrieveKnowledge(who, null, question, fixtureProvider().ai, options())).excerpts;
  } catch (error) {
    if (error instanceof KnowledgeRetrievalError) return [];
    throw error;
  }
};
// Every citation must match the current stored source exactly.
const expectCurrentCitation = async (
  sourceId: string,
  version: number,
  contentDigest: string,
  start: number,
  end: number,
  quote: string,
) => {
  const source = await getKnowledge(owner, sourceId);
  expect(source).toMatchObject({ version, contentDigest });
  expect(source.content!.slice(start, end)).toBe(quote);
};

it('hosted keyword retrieval reproduces the frozen baseline with exact current citations', async () => {
  const outcomes: EvaluationOutcome[] = [];
  let citations = 0;
  for (const question of EVALUATION_QUESTIONS) {
    const response = await keywordSearch(question.keywords);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ mode: 'keyword', modelUsed: false });
    const results = response.body.results as {
      sourceId: string;
      version: number;
      contentDigest: string;
      citation: { start: number; end: number; quote: string };
    }[];
    for (const hit of results) {
      citations++;
      await expectCurrentCitation(
        hit.sourceId,
        hit.version,
        hit.contentDigest,
        hit.citation.start,
        hit.citation.end,
        hit.citation.quote,
      );
    }
    outcomes.push({
      id: question.id,
      ranked: uniqueRanked(results.map((hit) => slugs.get(hit.sourceId)!)),
    });
  }
  expect(Object.fromEntries(outcomes.map((o) => [o.id, o.ranked]))).toEqual(KEYWORD_BASELINE);
  const metrics = scoreEvaluation(outcomes);
  expect(metrics).toMatchObject({ hitAt1: 1, hitAt3: 1, abstentionRate: 1, falseAnswerRate: 0 });
  expect(citations).toBeGreaterThan(0);
  console.info('KAN-50 keyword evaluation', JSON.stringify({ ...metrics, citations }));
});

it('semantic retrieval pipeline reproduces the fixture baseline and only returns current owned quotes', async () => {
  const outcomes: EvaluationOutcome[] = [];
  let citations = 0;
  for (const question of EVALUATION_QUESTIONS) {
    const excerpts = await semantic(question.question);
    expect(excerpts.length).toBeLessThanOrEqual(3);
    for (const item of excerpts) {
      citations++;
      expect(slugs.has(item.sourceId)).toBe(true);
      await expectCurrentCitation(
        item.sourceId,
        item.version,
        item.contentDigest,
        item.start,
        item.end,
        item.quote,
      );
    }
    outcomes.push({
      id: question.id,
      ranked: uniqueRanked(excerpts.map((item) => slugs.get(item.sourceId)!)),
    });
  }
  expect(Object.fromEntries(outcomes.map((o) => [o.id, o.ranked]))).toEqual(
    SEMANTIC_FIXTURE_BASELINE,
  );
  const metrics = scoreEvaluation(outcomes);
  expect(metrics).toMatchObject({ hitAt3: 0.8, abstentionRate: 1, falseAnswerRate: 0 });
  console.info('KAN-50 semantic fixture evaluation', JSON.stringify({ ...metrics, citations }));
});

it('another owner retrieves nothing from the evaluation corpus by keyword or semantic search', async () => {
  for (const question of EVALUATION_QUESTIONS.filter((item) => item.relevant.length)) {
    const response = await keywordSearch(question.keywords, strangerToken);
    expect(response.status).toBe(200);
    expect(response.body.results).toEqual([]);
    expect(await semantic(question.question, stranger)).toEqual([]);
  }
  for (const id of ids.values())
    expect(
      (
        await request(app)
          .get('/api/knowledge/' + id)
          .set({ Authorization: 'Bearer ' + strangerToken })
      ).status,
    ).toBe(404);
});

it('prompt-injection source text reaches generation only as labelled untrusted excerpt data', async () => {
  const agent = await Agent.create({
    owner,
    name: 'Evaluation reviewer',
    role: 'Research',
    permissions: ['task.read', 'artifact.draft', 'knowledge.read'],
  });
  const task = await Task.create({
    owner,
    title: 'Vendor note question',
    assigneeType: 'agent',
    assigneeAgent: agent._id,
  });
  const run = (
    await createOwnedRun(owner, {
      taskId: task.id,
      agentId: agent.id,
      input: 'What does the untrusted vendor note ask to approve automatically?',
      idempotencyKey: randomUUID(),
    })
  ).run;
  const local = fixtureProvider();
  const result = await createRunExecutor({ providerForMode: () => local.ai }).execute(
    owner,
    run.id,
    'local',
    undefined,
    false,
    'knowledge',
  );
  expect(result.status).toBe('awaiting-approval');
  const [messages] = local.structured.mock.calls[0];
  expect(messages).toHaveLength(2);
  expect(messages[0]).toEqual({ role: 'system', content: KNOWLEDGE_SYSTEM_INSTRUCTION });
  expect(messages[0].content).not.toContain('ignore all previous instructions');
  const payload = JSON.parse(messages[1].content) as {
    question: string;
    untrustedExcerpts: { key: string; quote: string }[];
  };
  expect(Object.keys(payload).sort()).toEqual(['question', 'untrustedExcerpts']);
  expect(payload.untrustedExcerpts.some((item) => item.quote.includes('ignore all previous'))).toBe(
    true,
  );
  for (const item of payload.untrustedExcerpts)
    expect(Object.keys(item).sort()).toEqual(['key', 'quote']);
  // The draft is never applied: the task, agent and approvals are unchanged.
  expect(await Task.findById(task.id).lean()).toMatchObject({ title: 'Vendor note question' });
  expect((await Run.findById(run.id).lean())?.review ?? null).toBeNull();
});

it('an edited source drops out of semantic retrieval until re-indexed and invalidates old citations', async () => {
  const before = await semantic('How long are database backups kept?');
  expect(before[0].sourceId).toBe(ids.get('backup-policy'));
  const current = await getKnowledge(owner, ids.get('backup-policy')!);
  const edited = await changeKnowledge(owner, current.id!, current.version, current.contentDigest, {
    title: current.title,
    content: 'Backups moved to a vendor service; see the new runbook.',
    kind: 'note',
    project: null,
  });
  const after = await semantic('How long are database backups kept?');
  expect(after.some((item) => item.sourceId === ids.get('backup-policy'))).toBe(false);
  const fresh = await getKnowledge(owner, current.id!);
  expect(fresh.version).toBe(current.version + 1);
  expect(fresh.content!.slice(before[0].start, before[0].end)).not.toBe(before[0].quote);
  expect(edited).toBeTruthy();
});
