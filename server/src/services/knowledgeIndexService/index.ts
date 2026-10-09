import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { AIProviderError, type AIProvider } from '../../ai/provider';
import {
  PINNED_EMBEDDING,
  EMBEDDING_BATCH_MAX,
  validateEmbeddingVectors,
} from '../../ai/embedding';
import { KnowledgeSource, type KnowledgeSourceDocument } from '../../models/knowledgeSourceModel';
import { Project } from '../../models/projectModel';
import { isObjectIdString } from '../../utils/objectId';
import { denyKnowledge, KnowledgeError, validKnowledgeVersion } from '../knowledgeService';
import { knowledgeDigest, KNOWLEDGE_SOURCE_WINDOW } from '../knowledgeService/primitives';
import {
  chunkKnowledge,
  matchesKnowledgeIndex,
  validKnowledgeIndex,
  type KnowledgeIndex,
} from './primitives';
const snapshot = (source: KnowledgeSourceDocument) => ({
  id: String(source._id),
  version: source.version,
  contentDigest: source.contentDigest,
  content: source.content,
});
const canonical = (source: KnowledgeSourceDocument) =>
  knowledgeDigest({
    title: source.title,
    content: source.content,
    kind: source.kind,
    project: source.project ? String(source.project) : null,
  }) === source.contentDigest;
// Reuse this explicit local factory/provider. No public endpoint, model resolution, pulls or background work.
export const createKnowledgeIndexer = (provider: AIProvider) => {
  if (process.env.NODE_ENV === 'production') throw new AIProviderError('DISABLED');
  if (
    provider.id !== 'ollama' ||
    !provider.capabilities.embeddings ||
    provider.embeddingIdentity?.model !== PINNED_EMBEDDING.model ||
    provider.embeddingIdentity.digest !== PINNED_EMBEDDING.digest ||
    provider.embeddingIdentity.dimensions !== PINNED_EMBEDDING.dimensions
  )
    throw new AIProviderError('UNSUPPORTED');
  let active = false;
  return {
    index: async ({
      owner,
      id,
      version,
      contentDigest,
      signal,
      timeoutMs = 60000,
    }: {
      owner: string;
      id: string;
      version: number;
      contentDigest: string;
      signal?: AbortSignal;
      timeoutMs?: number;
    }): Promise<KnowledgeIndex> => {
      if (process.env.NODE_ENV === 'production') throw new AIProviderError('DISABLED');
      if (
        !isObjectIdString(owner) ||
        !isObjectIdString(id) ||
        !validKnowledgeVersion(version, contentDigest) ||
        !Number.isInteger(timeoutMs) ||
        timeoutMs < 1 ||
        timeoutMs > 120000
      )
        throw new KnowledgeError(400, 'Invalid knowledge indexing request');
      if (signal?.aborted) throw new AIProviderError('CANCELLED');
      if (active) throw new AIProviderError('BUSY');
      active = true;
      const controller = new AbortController();
      const deadline = performance.now() + timeoutMs;
      const cancel = () => controller.abort();
      signal?.addEventListener('abort', cancel, { once: true });
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const remaining = () => {
        if (process.env.NODE_ENV === 'production') throw new AIProviderError('DISABLED');
        if (signal?.aborted) throw new AIProviderError('CANCELLED');
        const milliseconds = Math.floor(deadline - performance.now());
        if (milliseconds < 1 || controller.signal.aborted) throw new AIProviderError('TIMEOUT');
        return milliseconds;
      };
      try {
        const source = await KnowledgeSource.findOne({ _id: id, owner, deleted: false })
          .select('+embeddingIndex')
          .maxTimeMS(Math.min(5000, remaining()));
        remaining();
        if (!source)
          return await denyKnowledge(
            owner,
            id,
            'index',
            'source-not-found',
            404,
            'Knowledge source not found',
          );
        if (source.version !== version || source.contentDigest !== contentDigest)
          return await denyKnowledge(
            owner,
            id,
            'index',
            'state-conflict',
            409,
            'Source changed; refresh before indexing',
          );
        if (!canonical(source))
          throw new KnowledgeError(503, 'Knowledge source provenance is unavailable');
        if (
          source.project &&
          !(await Project.exists({ _id: source.project, owner }).maxTimeMS(
            Math.min(5000, remaining()),
          ))
        )
          return await denyKnowledge(
            owner,
            id,
            'index',
            'project-not-found',
            404,
            'Project not found',
          );
        if (source.embeddingIndex !== undefined) {
          if (!matchesKnowledgeIndex(source.embeddingIndex, snapshot(source)))
            throw new KnowledgeError(503, 'Knowledge index is stale or incompatible');
          remaining();
          return source.embeddingIndex;
        }
        const chunks = chunkKnowledge(source.content);
        const indexed: KnowledgeIndex['chunks'] = [];
        for (let offset = 0; offset < chunks.length; offset += EMBEDDING_BATCH_MAX) {
          const batch = chunks.slice(offset, offset + EMBEDDING_BATCH_MAX);
          const result = await provider.embed(
            batch.map((chunk) => source.content.slice(chunk.start, chunk.end)),
            { signal: controller.signal, timeoutMs: remaining() },
          );
          remaining();
          if (
            result.provider !== 'ollama' ||
            result.simulation ||
            result.embedding?.model !== PINNED_EMBEDDING.model ||
            result.embedding.digest !== PINNED_EMBEDDING.digest ||
            result.embedding.dimensions !== PINNED_EMBEDDING.dimensions ||
            !validateEmbeddingVectors(result.value, batch.length, PINNED_EMBEDDING)
          )
            throw new AIProviderError('INVALID_OUTPUT');
          indexed.push(...batch.map((chunk, i) => ({ ...chunk, vector: [...result.value[i]] })));
        }
        if (
          source.project &&
          !(await Project.exists({ _id: source.project, owner }).maxTimeMS(
            Math.min(5000, remaining()),
          ))
        )
          return await denyKnowledge(
            owner,
            id,
            'index',
            'project-not-found',
            404,
            'Project not found',
          );
        const index: KnowledgeIndex = {
          sourceId: String(source._id),
          sourceVersion: version,
          sourceDigest: contentDigest,
          identity: PINNED_EMBEDDING,
          indexedAt: new Date(),
          chunks: indexed,
        };
        if (!validKnowledgeIndex(index) || !matchesKnowledgeIndex(index, snapshot(source)))
          throw new KnowledgeError(503, 'Knowledge index provenance is unavailable');
        const updated = await KnowledgeSource.findOneAndUpdate(
          {
            _id: id,
            owner,
            deleted: false,
            version,
            contentDigest,
            embeddingIndex: { $exists: false },
          },
          {
            $set: { embeddingIndex: index },
            $push: {
              auditEvents: {
                id: randomUUID(),
                at: new Date(),
                actor: owner,
                kind: 'indexed',
                version,
                contentDigest,
              },
            },
          },
          { new: true, runValidators: true, maxTimeMS: Math.min(5000, remaining()) },
        ).select('+embeddingIndex');
        remaining();
        if (!updated)
          return await denyKnowledge(
            owner,
            id,
            'index',
            'state-conflict',
            409,
            'Source changed or was indexed; refresh before indexing',
          );
        if (!matchesKnowledgeIndex(updated.embeddingIndex, snapshot(updated)))
          throw new KnowledgeError(503, 'Knowledge index provenance is unavailable');
        return updated.embeddingIndex;
      } catch (error) {
        if (process.env.NODE_ENV === 'production') throw new AIProviderError('DISABLED');
        if (signal?.aborted) throw new AIProviderError('CANCELLED');
        if (controller.signal.aborted || performance.now() >= deadline)
          throw new AIProviderError('TIMEOUT');
        if (error instanceof AIProviderError || error instanceof KnowledgeError) throw error;
        throw new KnowledgeError(503, 'Knowledge indexing is temporarily unavailable');
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
        active = false;
      }
    },
  };
};
// Bounded current records for later permission-scoped semantic retrieval. No vector similarity here.
export const getCurrentKnowledgeIndexes = async (
  owner: string,
  project: string | null = null,
  unassociatedOnly = false,
) => {
  if (!isObjectIdString(owner) || (project !== null && !isObjectIdString(project)))
    throw new KnowledgeError(400, 'Invalid knowledge index filter');
  if (project && !(await Project.exists({ _id: project, owner }).maxTimeMS(5000)))
    throw new KnowledgeError(404, 'Project not found');
  const sources = await KnowledgeSource.find({
    owner,
    deleted: false,
    ...(project ? { project } : unassociatedOnly ? { project: null } : {}),
  })
    .select('+embeddingIndex')
    .sort({ slot: 1 })
    .limit(KNOWLEDGE_SOURCE_WINDOW + 1)
    .maxTimeMS(5000);
  if (sources.length > KNOWLEDGE_SOURCE_WINDOW)
    throw new KnowledgeError(503, 'Knowledge index capacity is unavailable');
  const projectIds = [
    ...new Set(
      sources
        .filter((source) => source.embeddingIndex !== undefined && source.project)
        .map((source) => String(source.project)),
    ),
  ];
  const ownedProjects = new Set(
    (projectIds.length
      ? await Project.find({ owner, _id: { $in: projectIds } })
          .select('_id')
          .limit(KNOWLEDGE_SOURCE_WINDOW)
          .maxTimeMS(5000)
      : []
    ).map((item) => String(item._id)),
  );
  const result: {
    sourceId: string;
    title: string;
    project: string | null;
    version: number;
    contentDigest: string;
    content: string;
    index: KnowledgeIndex;
  }[] = [];
  for (const source of sources) {
    if (!canonical(source))
      throw new KnowledgeError(503, 'Knowledge source provenance is unavailable');
    if (
      source.embeddingIndex === undefined ||
      (source.project && !ownedProjects.has(String(source.project)))
    )
      continue;
    if (!matchesKnowledgeIndex(source.embeddingIndex, snapshot(source)))
      throw new KnowledgeError(503, 'Knowledge index is stale or incompatible');
    result.push({
      sourceId: String(source._id),
      title: source.title,
      project: source.project ? String(source.project) : null,
      version: source.version,
      contentDigest: source.contentDigest,
      content: source.content,
      index: source.embeddingIndex,
    });
  }
  return result;
};
