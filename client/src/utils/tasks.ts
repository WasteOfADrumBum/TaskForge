import type { Task, TaskPriority, TaskStatus } from '../types/task';

export type TaskSort = 'created-desc' | 'created-asc' | 'due-asc' | 'priority-desc';

interface TaskFilters {
  search: string;
  status: TaskStatus | 'all';
  priority: TaskPriority | 'all';
  sort: TaskSort;
}

const priorityRank: Record<TaskPriority, number> = { low: 1, medium: 2, high: 3 };

export const isTaskOverdue = (task: Task) => {
  if (!task.dueDate || task.status === 'done') return false;
  const due = new Date(task.dueDate);
  const today = new Date();
  due.setHours(23, 59, 59, 999);
  return due.getTime() < today.getTime();
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
      const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    }
    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return filters.sort === 'created-asc' ? aCreated - bCreated : bCreated - aCreated;
  });
};

export const getTaskSummary = (tasks: Task[]) => ({
  total: tasks.length,
  todo: tasks.filter((task) => task.status === 'todo').length,
  inProgress: tasks.filter((task) => task.status === 'in-progress').length,
  done: tasks.filter((task) => task.status === 'done').length,
  overdue: tasks.filter(isTaskOverdue).length,
});
