import type { Request, Response } from 'express';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../models/taskModel';
import {
  createTask,
  deleteTaskById,
  findTasksByOwner,
  updateTaskById,
  type TaskUpdate,
} from '../../services/taskService';

type TaskParams = { id: string };

const getUserId = (req: Request) => req.userId as string;

export const listTasks = async (req: Request, res: Response) => {
  try {
    const tasks = await findTasksByOwner(getUserId(req));
    return res.json({ tasks });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const createTaskHandler = async (req: Request, res: Response) => {
  const { title, description, status, priority, dueDate } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ message: 'Task title is required' });
  }

  if (status && !TASK_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Invalid task status' });
  }

  if (priority && !TASK_PRIORITIES.includes(priority)) {
    return res.status(400).json({ message: 'Invalid task priority' });
  }

  try {
    const task = await createTask(getUserId(req), {
      title: title.trim(),
      description,
      status,
      priority,
      dueDate,
    });
    return res.status(201).json({ task });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const updateTaskHandler = async (req: Request<TaskParams>, res: Response) => {
  const { title, description, status, priority, dueDate } = req.body;

  if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
    return res.status(400).json({ message: 'Task title cannot be empty' });
  }

  if (status !== undefined && !TASK_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Invalid task status' });
  }

  if (priority !== undefined && !TASK_PRIORITIES.includes(priority)) {
    return res.status(400).json({ message: 'Invalid task priority' });
  }

  const updates: TaskUpdate = {};
  if (title !== undefined) updates.title = title.trim();
  if (description !== undefined) updates.description = description;
  if (status !== undefined) updates.status = status;
  if (priority !== undefined) updates.priority = priority;
  if (dueDate !== undefined) updates.dueDate = dueDate;

  try {
    const task = await updateTaskById(getUserId(req), req.params.id, updates);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    return res.json({ task });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const deleteTaskHandler = async (req: Request<TaskParams>, res: Response) => {
  try {
    const task = await deleteTaskById(getUserId(req), req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};
