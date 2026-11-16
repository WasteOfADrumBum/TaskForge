import type { Request, Response } from 'express';
import { RESUME_BODY_MAX, RESUME_HEADLINE_MAX, RESUME_SUMMARY_MAX } from '../../models/resumeModel';
import {
  findResumeByOwner,
  ResumeUnavailableError,
  saveResume,
  type ResumeInput,
} from '../../services/resumeService';

const getUserId = (req: Request) => req.userId as string;

// The three text fields, each optional and defaulting to empty, or an error. owner, _id and
// timestamps are never read from the body.
const readResume = (body: Record<string, unknown>): { value: ResumeInput } | { error: string } => {
  const fields: Array<[keyof ResumeInput, number, string]> = [
    ['headline', RESUME_HEADLINE_MAX, 'Headline'],
    ['summary', RESUME_SUMMARY_MAX, 'Summary'],
    ['body', RESUME_BODY_MAX, 'Resume'],
  ];
  const value: ResumeInput = { headline: '', summary: '', body: '' };
  for (const [key, max, label] of fields) {
    const raw = body[key];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== 'string') return { error: 'Invalid ' + label.toLowerCase() };
    const text = key === 'body' ? raw : raw.trim();
    if (text.length > max) return { error: label + ' is too long' };
    value[key] = text;
  }
  return { value };
};

export const getResume = async (req: Request, res: Response) => {
  try {
    return res.json({ resume: await findResumeByOwner(getUserId(req)) });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const putResume = async (req: Request, res: Response) => {
  const fields = readResume((req.body ?? {}) as Record<string, unknown>);
  if ('error' in fields) return res.status(400).json({ message: fields.error });
  try {
    return res.json({ resume: await saveResume(getUserId(req), fields.value) });
  } catch (error) {
    if (error instanceof ResumeUnavailableError) {
      return res.status(503).json({ message: 'Your resume is temporarily unavailable' });
    }
    return res.status(500).json({ message: 'Server error' });
  }
};
