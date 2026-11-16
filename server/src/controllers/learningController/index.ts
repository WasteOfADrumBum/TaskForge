import type { Request, Response } from 'express';
import {
  LEARNING_KINDS,
  LEARNING_NOTES_MAX,
  LEARNING_STATUSES,
  LEARNING_TITLE_MAX,
  LEARNING_URL_MAX,
} from '../../models/learningModel';
import {
  createLearningItem,
  deleteLearningItemById,
  findLearningByOwner,
  updateLearningItemById,
  type LearningInput,
  type LearningUpdate,
} from '../../services/learningService';
import { normalizeCalendarDate } from '../../utils/calendarDate';
import { readHttpsLink } from '../../utils/httpsLink';
import { isObjectIdString } from '../../utils/objectId';
import { toSkillSlug } from '../../utils/skillSlug';

type IdParams = { id: string };

const getUserId = (req: Request) => req.userId as string;
const notFound = (res: Response) => res.status(404).json({ message: 'Learning item not found' });

// Validated, normalized fields from the body: only the fields that are present, or an error.
// owner, _id, completedAt and timestamps are never read from the body.
const readLearningFields = (
  body: Record<string, unknown>,
  requireTitle: boolean,
): { value: LearningUpdate } | { error: string } => {
  const { title, skill, kind, url, status, targetDate, notes } = body;
  const value: LearningUpdate = {};
  if (requireTitle || title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) return { error: 'Learning title is required' };
    if (title.trim().length > LEARNING_TITLE_MAX) return { error: 'Learning title is too long' };
    value.title = title.trim();
  }
  if (skill !== undefined) {
    if (skill === '' || skill === null) value.skill = '';
    else {
      const slug = toSkillSlug(skill);
      if (!slug) return { error: 'Invalid skill name' };
      value.skill = slug;
    }
  }
  if (kind !== undefined) {
    if (!LEARNING_KINDS.includes(kind as never)) return { error: 'Invalid learning kind' };
    value.kind = kind as LearningUpdate['kind'];
  }
  if (url !== undefined) {
    const link = readHttpsLink(url, LEARNING_URL_MAX);
    if ('error' in link) {
      return {
        error: link.error === 'not-https' ? 'Link must be an https address' : 'Invalid link',
      };
    }
    value.url = link.value;
  }
  if (status !== undefined) {
    if (!LEARNING_STATUSES.includes(status as never)) return { error: 'Invalid learning status' };
    value.status = status as LearningUpdate['status'];
  }
  if (targetDate !== undefined) {
    if (targetDate === null || targetDate === '') value.targetDate = null;
    else {
      const normalized = normalizeCalendarDate(targetDate);
      if (normalized === null) return { error: 'Invalid target date' };
      value.targetDate = normalized;
    }
  }
  if (notes !== undefined) {
    if (typeof notes !== 'string') return { error: 'Invalid notes' };
    if (notes.trim().length > LEARNING_NOTES_MAX) return { error: 'Notes are too long' };
    value.notes = notes.trim();
  }
  return { value };
};

export const listLearning = async (req: Request, res: Response) => {
  try {
    return res.json({ items: await findLearningByOwner(getUserId(req)) });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const createLearningHandler = async (req: Request, res: Response) => {
  const fields = readLearningFields((req.body ?? {}) as Record<string, unknown>, true);
  if ('error' in fields) return res.status(400).json({ message: fields.error });
  try {
    const item = await createLearningItem(getUserId(req), fields.value as LearningInput);
    return res.status(201).json({ item });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const updateLearningHandler = async (req: Request<IdParams>, res: Response) => {
  if (!isObjectIdString(req.params.id)) return notFound(res);
  const fields = readLearningFields((req.body ?? {}) as Record<string, unknown>, false);
  if ('error' in fields) return res.status(400).json({ message: fields.error });
  try {
    const item = await updateLearningItemById(getUserId(req), req.params.id, fields.value);
    if (!item) return notFound(res);
    return res.json({ item });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const deleteLearningHandler = async (req: Request<IdParams>, res: Response) => {
  if (!isObjectIdString(req.params.id)) return notFound(res);
  try {
    const item = await deleteLearningItemById(getUserId(req), req.params.id);
    if (!item) return notFound(res);
    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};
