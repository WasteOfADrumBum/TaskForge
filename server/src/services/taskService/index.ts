import { Task } from '../../models/taskModel';

export interface TaskInput {
  title: string;
  description?: string;
  status?: 'todo' | 'in-progress' | 'done';
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string | null;
  // A project the owner owns, or null for no project. The controller checks ownership.
  project?: string | null;
}

export type TaskUpdate = Partial<TaskInput>;

export const createTask = async (ownerId: string, taskData: TaskInput) => {
  return Task.create({ ...taskData, owner: ownerId });
};

export const findTasksByOwner = async (ownerId: string) => {
  return Task.find({ owner: ownerId }).sort({ createdAt: -1 });
};

export const updateTaskById = async (ownerId: string, taskId: string, updates: TaskUpdate) => {
  return Task.findOneAndUpdate({ _id: taskId, owner: ownerId }, updates, {
    new: true,
    runValidators: true,
  });
};

export const deleteTaskById = async (ownerId: string, taskId: string) => {
  return Task.findOneAndDelete({ _id: taskId, owner: ownerId });
};
