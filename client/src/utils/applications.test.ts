import { describe, expect, it } from 'vitest';
import type { SavedJob } from '../types/career';
import type { Task } from '../types/task';
import {
  applicationSinceText,
  followUpTaskTitle,
  getApplications,
  hasFollowUpTask,
} from './applications';

const at = (year: number, month: number, day: number, hour = 12) =>
  new Date(year, month - 1, day, hour).toISOString();
const job = (
  title: string,
  status: SavedJob['status'],
  statusChangedAt: string | null = null,
  company = '',
): SavedJob => ({
  title,
  company,
  url: '',
  requiredSkills: [],
  status,
  notes: '',
  statusChangedAt,
});
const now = new Date(2026, 10, 16, 9);

describe('applications', () => {
  it('counts active statuses and lists them longest unchanged first, unknown dates last', () => {
    const { counts, active } = getApplications(
      [
        job('Saved', 'saved', at(2026, 10, 1)),
        job('Recent', 'interviewing', at(2026, 11, 15)),
        job('Legacy', 'applied'),
        job('Old', 'applied', at(2026, 11, 2)),
        job('Offer', 'offer', at(2026, 11, 10)),
        job('Gone', 'rejected', at(2026, 10, 1)),
      ],
      now,
    );
    expect(counts).toEqual({ applied: 2, interviewing: 1, offer: 1 });
    expect(active.map((entry) => [entry.job.title, entry.days, entry.needsFollowUp])).toEqual([
      ['Old', 14, true],
      ['Offer', 6, false],
      ['Recent', 1, false],
      ['Legacy', null, false],
    ]);
  });

  it('needs a follow-up only for an application still applied after 14 days', () => {
    const { active } = getApplications(
      [
        job('Thirteen', 'applied', at(2026, 11, 3)),
        job('Interview', 'interviewing', at(2026, 10, 1)),
      ],
      now,
    );
    expect(active.map((entry) => entry.needsFollowUp)).toEqual([false, false]);
  });

  it('says since when in words, or nothing when unknown', () => {
    const [old, recent, today, legacy] = getApplications(
      [
        job('A', 'applied', at(2026, 11, 2)),
        job('B', 'applied', at(2026, 11, 15)),
        job('C', 'applied', at(2026, 11, 16, 8)),
        job('D', 'applied', 'not a date'),
      ],
      now,
    ).active;
    expect(applicationSinceText(old)).toBe(
      'Since ' +
        new Date(Date.UTC(2026, 10, 2)).toLocaleDateString(undefined, { timeZone: 'UTC' }) +
        ' (14 days)',
    );
    expect(applicationSinceText(recent)).toMatch(/\(1 day\)$/);
    expect(applicationSinceText(today)).toMatch(/\(today\)$/);
    expect(applicationSinceText(legacy)).toBeNull();
  });

  it('names follow-up tasks and finds them', () => {
    const withCompany = job('Dev', 'applied', null, 'Acme');
    expect(followUpTaskTitle(withCompany)).toBe('Follow up on Dev at Acme');
    expect(followUpTaskTitle(job('Dev', 'applied'))).toBe('Follow up on Dev');
    expect(followUpTaskTitle(job('x'.repeat(130), 'applied'))).toHaveLength(120);
    const tasks = [{ title: 'Follow up on Dev at Acme' }] as Task[];
    expect(hasFollowUpTask(tasks, withCompany)).toBe(true);
    expect(hasFollowUpTask(tasks, job('Dev', 'applied'))).toBe(false);
  });
});
