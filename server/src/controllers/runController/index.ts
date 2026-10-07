import type { Request, Response } from 'express';
import { RUN_INPUT_MAX, RUN_KEY_PATTERN } from '../../models/runModel';
import {
  createOwnedRun,
  getOwnedRun,
  listOwnedRuns,
  RunInputError,
} from '../../services/runService';
import { isObjectIdString } from '../../utils/objectId';
const owner = (req: Request) => req.userId as string;
const notFound = (res: Response) => res.status(404).json({ message: 'Run not found' });

export const createRunHandler = async (req: Request, res: Response) => {
  const body = req.body as unknown;
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return res.status(400).json({ message: 'Invalid run input' });
  const { taskId, agentId, input } = body as Record<string, unknown>;
  const key = req.get('Idempotency-Key');
  if (!isObjectIdString(taskId) || !isObjectIdString(agentId))
    return res.status(400).json({ message: 'Invalid task or agent' });
  if (typeof input !== 'string' || !input.trim() || input.length > RUN_INPUT_MAX)
    return res.status(400).json({ message: 'Run input must be 1–8000 characters' });
  if (!key || key !== key.trim() || !RUN_KEY_PATTERN.test(key))
    return res.status(400).json({ message: 'Valid Idempotency-Key is required' });
  try {
    const result = await createOwnedRun(owner(req), {
      taskId,
      agentId,
      input,
      idempotencyKey: key,
    });
    return res.status(result.created ? 201 : 200).json({ run: result.run });
  } catch (error) {
    if (error instanceof RunInputError)
      return res.status(error.status).json({ message: error.message });
    return res.status(500).json({ message: 'Server error' });
  }
};
export const listRunsHandler = async (req: Request, res: Response) => {
  try {
    return res.json({ runs: await listOwnedRuns(owner(req)) });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};
export const getRunHandler = async (req: Request, res: Response) => {
  if (!isObjectIdString(req.params.id)) return notFound(res);
  try {
    const run = await getOwnedRun(owner(req), req.params.id as string);
    return run ? res.json({ run }) : notFound(res);
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};
export const executeRunGuard = async (req: Request, res: Response) => {
  if (!isObjectIdString(req.params.id)) return notFound(res);
  try {
    if (!(await getOwnedRun(owner(req), req.params.id as string))) return notFound(res);
    return res.status(503).json({
      message: 'Run execution is unavailable until permission and audit safeguards are implemented',
    });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};
