import type { Task, TaskPriority, TaskStatus } from '../types/task';
import { daysUntilDueDate, toCalendarDate } from './dates';

export type TaskSort = 'created-desc' | 'created-asc' | 'due-asc' | 'priority-desc';

interface TaskFilters {
  search: string;
  status: TaskStatus | 'all';
  priority: TaskPriority | 'all';
  sort: TaskSort;
}

const priorityRank: Record<TaskPriority, number> = { low: 1, medium: 2, high: 3 };

// Overdue = an unfinished task whose due calendar date is before today's local calendar date.
export const isTaskOverdue = (task: Task, now: Date = new Date()) => {
  if (task.status === 'done') return false;
  const days = daysUntilDueDate(task.dueDate, now);
  return days !== null && days < 0;
};

export const filterAndSortTasks = (tasks: Task[], filters: TaskFilters) => {
  const search = filters.search.trim().toLowerCase();
  const filtered = tasks.filter((task) => {
    const matchesSearch =
      !search ||
      task.title.toLowerCase().includes(search) ||
      task.description.toLowerCase().includes(search);
    const matchesStatus = filters.status === 'all' || task.status === filters.status;
    const matchesPriority = filters.priority === 'all' || task.priority === filters.priority;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return [...filtered].sort((a, b) => {
    if (filters.sort === 'priority-desc')
      return priorityRank[b.priority] - priorityRank[a.priority];
    if (filters.sort === 'due-asc') {
      // Calendar dates compare correctly as strings; tasks without a due date go last.
      const aDue = toCalendarDate(a.dueDate) ?? '9999-12-31';
      const bDue = toCalendarDate(b.dueDate) ?? '9999-12-31';
      return aDue < bDue ? -1 : aDue > bDue ? 1 : 0;
    }
    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return filters.sort === 'created-asc' ? aCreated - bCreated : bCreated - aCreated;
  });
};

export const getTaskSummary = (tasks: Task[], now: Date = new Date()) => ({
  total: tasks.length,
  todo: tasks.filter((task) => task.status === 'todo').length,
  inProgress: tasks.filter((task) => task.status === 'in-progress').length,
  done: tasks.filter((task) => task.status === 'done').length,
  // Not `filter(isTaskOverdue)`: filter would pass the array index as `now`.
  overdue: tasks.filter((task) => isTaskOverdue(task, now)).length,
});
