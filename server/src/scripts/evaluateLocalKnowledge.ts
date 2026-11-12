import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { User } from '../models/userModel';
import { KnowledgeSource } from '../models/knowledgeSourceModel';
import { KnowledgeDenial } from '../models/knowledgeDenialModel';
import { Project } from '../models/projectModel';
import { PINNED_EMBEDDING } from '../ai/embedding';
import { resolveConfiguredProvider } from '../ai/provider';
import { createKnowledge, getKnowledge } from '../services/knowledgeService';
import { createKnowledgeIndexer } from '../services/knowledgeIndexService';
import { KnowledgeRetrievalError, retrieveKnowledge } from '../services/groundedKnowledgeService';
import {
  EVALUATION_CORPUS,
  EVALUATION_QUESTIONS,
  scoreEvaluation,
  uniqueRanked,
} from '../evaluation/knowledgeEvaluation';

// KAN-50: real pinned local embeddings over the frozen corpus. Retrieval only: no generation,
// no Runs and no task data. Reports metrics; it does not tune or retry.
const namespace = process.env.TEST_MONGO_URI;
if (
  process.argv.slice(2).join(' ') !== '--local-only --evaluate' ||
  process.env.NODE_ENV === 'production' ||
  process.env.AI_PROVIDER !== 'ollama' ||
  process.env.OLLAMA_EMBEDDING_MODEL !== PINNED_EMBEDDING.model ||
  !namespace ||
  !/^mongodb:\/\/(?:127[.]0[.]0[.]1|localhost):[0-9]{1,5}\/taskforge_qa_[a-zA-Z0-9_]{8,}$/.test(
    namespace,
  )
) {
  console.error(
    'Local knowledge evaluation requires pinned explicit local opt-in and fresh loopback MongoDB.',
  );
  process.exit(1);
}
try {
  await mongoose.connect(namespace, {
    autoCreate: false,
    autoIndex: false,
    serverSelectionTimeoutMS: 5000,
  });
  const db = mongoose.connection.db;
  assert.ok(db);
  assert.equal((await db.listCollections().toArray()).length, 0);
  for (const model of [User, Project, KnowledgeSource, KnowledgeDenial]) {
    await model.createCollection();
    await model.createIndexes();
  }
  const owner = (
    await User.create({
      email: 'evaluation-local-' + randomUUID() + '@example.test',
      password: 'synthetic-only',
    })
  ).id;
  const provider = resolveConfiguredProvider();
  const indexer = createKnowledgeIndexer(provider);
  const slugs = new Map<string, string>();
  for (const item of EVALUATION_CORPUS) {
    const source = (
      await createKnowledge(
        owner,
        { title: item.title, content: item.content, kind: 'note', project: null },
        randomUUID(),
      )
    ).source!;
    slugs.set(source.id!, item.slug);
    await indexer.index({
      owner,
      id: source.id!,
      version: source.version,
      contentDigest: source.contentDigest,
    });
  }
  let citations = 0;
  const outcomes = [];
  const misses: string[] = [];
  for (const question of EVALUATION_QUESTIONS) {
    let excerpts: Awaited<ReturnType<typeof retrieveKnowledge>>['excerpts'] = [];
    try {
      excerpts = (
        await retrieveKnowledge(owner, null, question.question, provider, {
          signal: new AbortController().signal,
          timeoutMs: 60000,
        })
      ).excerpts;
    } catch (error) {
      if (!(error instanceof KnowledgeRetrievalError)) throw error;
    }
    for (const item of excerpts) {
      const source = await getKnowledge(owner, item.sourceId);
      assert.equal(source.content!.slice(item.start, item.end), item.quote);
      citations++;
    }
    const ranked = uniqueRanked(excerpts.map((item) => slugs.get(item.sourceId)!));
    if (
      question.relevant.length
        ? !ranked.some((slug) => question.relevant.includes(slug))
        : ranked.length
    )
      misses.push(question.id + ': ' + (ranked.join(', ') || 'abstained'));
    outcomes.push({ id: question.id, ranked });
  }
  console.log(
    JSON.stringify({
      status: 'completed',
      actualOllama: true,
      actualMongo: true,
      pinnedEmbedding: PINNED_EMBEDDING.model,
      ...scoreEvaluation(outcomes),
      citations,
      exactCitations: true,
      misses,
      productionCalls: 0,
      paidCalls: 0,
    }),
  );
} catch {
  console.error(
    'Local knowledge evaluation failed; no fallback, replay, production access or reset performed.',
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
