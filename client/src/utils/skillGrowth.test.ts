import { describe, expect, it } from 'vitest';
import type { SavedJob, Skill } from '../types/career';
import type { Task } from '../types/task';
import { getSkillGrowth, TOP_GAP_LIMIT } from './skillGrowth';

// Local dates, so these tests behave the same in every time zone.
const now = new Date(2026, 10, 18, 15); // Wed Nov 18 2026; the week is Nov 16 to Nov 22
const at = (day: number, hour = 12) => new Date(2026, 10, day, hour).toISOString();
const skill = (name: string, created: number, updated = created): Skill => ({
  _id: 'skill-' + name,
  name,
  level: 'working',
  createdAt: at(created),
  updatedAt: at(updated, created === updated ? 12 : 13),
});
const job = (overrides: Partial<SavedJob> & { title: string }): SavedJob => ({
  _id: 'job-' + overrides.title,
  company: '',
  url: '',
  requiredSkills: [],
  status: 'saved',
  notes: '',
  ...overrides,
});
const task = (overrides: Partial<Task> & { title: string }): Task => ({
  _id: 'task-' + overrides.title,
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
  ...overrides,
});

describe('getSkillGrowth', () => {
  it('lists skills added this week and older skills whose level changed this week', () => {
    const skills = [
      skill('typescript', 18),
      skill('react', 16),
      skill('node', 2, 17),
      skill('css', 2, 15), // changed last week
      skill('sql', 2), // never changed
      skill('rust', 23), // next week
      skill('go', 17, 18), // added this week and changed: listed once, as added
    ];
    const growth = getSkillGrowth(skills, [], [], now);
    expect(growth.added.map((item) => item.name)).toEqual(['go', 'react', 'typescript']);
    expect(growth.levelChanged.map((item) => item.name)).toEqual(['node']);
  });

  it('counts the whole local week from Monday to Sunday', () => {
    const skills = [skill('monday', 16), skill('sunday', 22), skill('last-sunday', 15)];
    const sunday = new Date(2026, 10, 22, 23, 59);
    expect(getSkillGrowth(skills, [], [], sunday).added.map((item) => item.name)).toEqual([
      'monday',
      'sunday',
    ]);
  });

  it('lists learning tasks from a skill gap finished this week, newest first', () => {
    const jobs = [job({ title: 'Frontend Engineer', requiredSkills: ['graphql', 'react'] })];
    const tasks = [
      task({ title: 'Learn graphql for Frontend Engineer', status: 'done', completedAt: at(17) }),
      task({ title: 'Learn react for Frontend Engineer', status: 'done', completedAt: at(18) }),
      task({ title: 'Learn rust for Frontend Engineer', status: 'done', completedAt: at(18) }),
      task({ title: 'Learn graphql for Frontend Engineer', status: 'todo' }),
      task({ title: 'Learn react for Frontend Engineer', status: 'done', completedAt: at(10) }),
      task({ title: 'Learn react for Frontend Engineer', status: 'done', completedAt: null }),
    ];
    const learned = getSkillGrowth([], jobs, tasks, now).learned;
    expect(learned.map((item) => item.title)).toEqual([
      'Learn react for Frontend Engineer',
      'Learn graphql for Frontend Engineer',
    ]);
  });

  it('ranks the skills most often missing across open saved jobs', () => {
    const skills = [skill('react', 2)];
    const jobs = [
      job({ title: 'A', requiredSkills: ['react', 'graphql', 'aws', 'aws'] }),
      job({ title: 'B', requiredSkills: ['graphql', 'docker'], status: 'applied' }),
      job({ title: 'C', requiredSkills: ['graphql', 'aws'], status: 'interviewing' }),
      job({ title: 'D', requiredSkills: ['kotlin'], status: 'rejected' }),
      job({ title: 'E', requiredSkills: ['swift'], status: 'closed' }),
    ];
    const growth = getSkillGrowth(skills, jobs, [], now);
    expect(growth.hasOpenJobs).toBe(true);
    expect(growth.topGaps).toEqual([
      { skill: 'graphql', jobs: 3 },
      { skill: 'aws', jobs: 2 },
      { skill: 'docker', jobs: 1 },
    ]);
  });

  it('keeps at most the top gaps, and reports when no job is open', () => {
    const many = Array.from({ length: TOP_GAP_LIMIT + 2 }, (_, index) => 'skill-' + index);
    const growth = getSkillGrowth([], [job({ title: 'A', requiredSkills: many })], [], now);
    expect(growth.topGaps).toHaveLength(TOP_GAP_LIMIT);
    const closed = getSkillGrowth(
      [],
      [job({ title: 'A', requiredSkills: ['aws'], status: 'closed' })],
      [],
      now,
    );
    expect(closed).toMatchObject({ topGaps: [], hasOpenJobs: false });
  });
});
