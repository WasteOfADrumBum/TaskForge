import type { Request, Response } from 'express';
import {
  createKnowledge,
  getKnowledge,
  listKnowledge,
  searchKnowledge,
  changeKnowledge,
  knowledgeAudit,
  knowledgeDenials,
  denyKnowledge,
  KnowledgeError,
  validKnowledgeId,
  validKnowledgeVersion,
  type KnowledgeAction,
} from '../../services/knowledgeService';
import {
  normalizeKnowledgeInput,
  parseKnowledgeQuery,
  KnowledgeInputError,
} from '../../services/knowledgeService/primitives';
import { RUN_KEY_PATTERN } from '../../models/runModel';
const owner = (req: Request) => req.userId as string;
const handle =
  (action: KnowledgeAction, operation: (req: Request) => Promise<unknown>) =>
  async (req: Request, res: Response) => {
    try {
      const value = await operation(req);
      if (action === 'delete') return res.status(204).send();
      if (action === 'create') {
        const created = value as { created: boolean; source: unknown };
        return res.status(created.created ? 201 : 200).json({ source: created.source });
      }
      return res.json(value);
    } catch (error) {
      let failure: unknown = error;
      if (error instanceof KnowledgeInputError) {
        try {
          await denyKnowledge(
            owner(req),
            validKnowledgeId(req.params.id) ? String(req.params.id) : null,
            action,
            'invalid-input',
            400,
            error.message,
          );
        } catch (denied) {
          failure = denied;
        }
      }
      if (failure instanceof KnowledgeError)
        return res.status(failure.status).json({ message: failure.message });
      return res.status(503).json({ message: 'Knowledge is temporarily unavailable' });
    }
  };
const id = async (req: Request, action: KnowledgeAction) => {
  if (!validKnowledgeId(req.params.id))
    return denyKnowledge(
      owner(req),
      null,
      action,
      'source-not-found',
      404,
      'Knowledge source not found',
    );
  return req.params.id as string;
};
const project = (req: Request, allowed: string[]) => {
  if (Object.keys(req.query).some((key) => !allowed.includes(key))) throw new KnowledgeInputError();
  if (req.query.project !== undefined && !validKnowledgeId(req.query.project))
    throw new KnowledgeInputError();
  return req.query.project as string | undefined;
};
export const createKnowledgeHandler = handle('create', async (req) => {
  const key = req.get('Idempotency-Key');
  if (!key || key !== key.trim() || !RUN_KEY_PATTERN.test(key)) throw new KnowledgeInputError();
  return createKnowledge(owner(req), req.body, key);
});
export const listKnowledgeHandler = handle('read', async (req) => ({
  sources: await listKnowledge(owner(req), project(req, ['project'])),
}));
export const getKnowledgeHandler = handle('read', async (req) => ({
  source: await getKnowledge(owner(req), await id(req, 'read')),
}));
export const searchKnowledgeHandler = handle('search', async (req) => {
  const filter = project(req, ['project', 'q']);
  parseKnowledgeQuery(req.query.q);
  return {
    mode: 'keyword',
    modelUsed: false,
    results: await searchKnowledge(owner(req), req.query.q as string, filter),
  };
});
const mutation = async (req: Request, action: 'update' | 'delete') => {
  const sourceId = await id(req, action);
  const body = req.body as unknown;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new KnowledgeInputError();
  const record = body as Record<string, unknown>;
  const { version, contentDigest, ...input } = record;
  if (!validKnowledgeVersion(version, contentDigest)) throw new KnowledgeInputError();
  if (action === 'delete' && Object.keys(input).length) throw new KnowledgeInputError();
  const source = await changeKnowledge(
    owner(req),
    sourceId,
    version as number,
    contentDigest as string,
    action === 'delete' ? null : normalizeKnowledgeInput(input),
  );
  return { source };
};
export const updateKnowledgeHandler = handle('update', (req) => mutation(req, 'update'));
export const deleteKnowledgeHandler = handle('delete', (req) => mutation(req, 'delete'));
export const knowledgeAuditHandler = handle('read', async (req) =>
  knowledgeAudit(owner(req), await id(req, 'read')),
);
export const knowledgeDenialsHandler = handle('read', async (req) => ({
  events: await knowledgeDenials(owner(req)),
}));
