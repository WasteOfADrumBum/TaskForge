import { getProjectId, type Project } from '../types/project';
import { getTaskId, type Task } from '../types/task';
import { getRecentActivity } from './commandCenter';
import { isTaskOverdue } from './tasks';

// Pure, task-derived project insights. Everything comes from data the API already returns.

export interface ProjectTaskStats {
  total: number;
  open: number;
  inProgress: number;
  done: number;
  overdue: number;
  // Rounded percentage of tasks that are done; 0 when the project has no tasks.
  completion: number;
}

const emptyStats = (): ProjectTaskStats => ({
  total: 0,
  open: 0,
  inProgress: 0,
  done: 0,
  overdue: 0,
  completion: 0,
});

export const getTasksForProject = (tasks: Task[], projectId: string) =>
  tasks.filter((task) => task.project === projectId);

// Stats for every project in one pass over the tasks, keyed by project id.
export const getProjectStats = (
  tasks: Task[],
  now: Date = new Date(),
): Map<string, ProjectTaskStats> => {
  const stats = new Map<string, ProjectTaskStats>();
  for (const task of tasks) {
    if (!task.project) continue;
    const entry = stats.get(task.project) ?? emptyStats();
    entry.total += 1;
    if (task.status === 'done') entry.done += 1;
    else entry.open += 1;
    if (task.status === 'in-progress') entry.inProgress += 1;
    if (isTaskOverdue(task, now)) entry.overdue += 1;
    stats.set(task.project, entry);
  }
  for (const entry of stats.values()) {
    entry.completion = Math.round((entry.done / entry.total) * 100);
  }
  return stats;
};

export const getStatsForProject = (
  stats: Map<string, ProjectTaskStats>,
  projectId: string,
): ProjectTaskStats => stats.get(projectId) ?? emptyStats();

export interface ProjectActivityItem {
  id: string;
  label: string;
  at: string;
  kind: 'project' | 'task';
}

// Derived from createdAt/updatedAt only. The API keeps no change history, so this shows the
// latest change per record, not a full audit log.
export const getProjectActivity = (
  project: Project,
  tasks: Task[],
  limit = 8,
): ProjectActivityItem[] => {
  const items: ProjectActivityItem[] = [];
  const projectId = getProjectId(project);
  if (project.createdAt) {
    items.push({
      id: projectId + ':created',
      label: 'Project created',
      at: project.createdAt,
      kind: 'project',
    });
  }
  if (project.updatedAt && project.updatedAt !== project.createdAt) {
    items.push({
      id: projectId + ':updated',
      label: 'Project details updated',
      at: project.updatedAt,
      kind: 'project',
    });
  }
  for (const { task, action, at } of getRecentActivity(
    getTasksForProject(tasks, projectId),
    limit,
  )) {
    items.push({
      id: getTaskId(task) + ':' + action,
      label: (action === 'created' ? 'Created' : 'Updated') + ' “' + task.title + '”',
      at,
      kind: 'task',
    });
  }
  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, limit);
};

// Projects sorted for pickers and lists: active first, then completed, then archived,
// alphabetically within each status.
const statusOrder = { active: 0, completed: 1, archived: 2 } as const;
export const sortProjects = (projects: Project[]) =>
  [...projects].sort(
    (a, b) => statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name),
  );
