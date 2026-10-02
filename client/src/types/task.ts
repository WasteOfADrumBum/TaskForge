export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  _id?: string;
  id?: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  // Id of the owner's project, or null/absent when the task has no project.
  project?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  project?: string | null;
}

export type TaskUpdate = Partial<TaskInput>;

export const getTaskId = (task: Task) => task._id ?? task.id ?? '';
