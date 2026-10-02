import type { Request, Response } from 'express';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../models/taskModel';
import { ownsProject } from '../../services/projectService';
import {
  createTask,
  deleteTaskById,
  findTasksByOwner,
  updateTaskById,
  type TaskUpdate,
} from '../../services/taskService';
import { isObjectIdString } from '../../utils/objectId';

type TaskParams = { id: string };

const getUserId = (req: Request) => req.userId as string;

// Resolves the optional `project` field: undefined leaves it unchanged, null or '' unassigns,
// and anything else must be the id of a project the user owns. A malformed id, a missing
// project, and another user's project are all rejected with a 400. The same response for the
// last two means the API never reveals whether another user's project exists.
const resolveProject = async (
  ownerId: string,
  project: unknown,
): Promise<{ value: string | null | undefined } | { error: string }> => {
  if (project === undefined) return { value: undefined };
  if (project === null || project === '') return { value: null };
  if (!isObjectIdString(project)) return { error: 'Invalid project' };
  if (!(await ownsProject(ownerId, project))) return { error: 'Project not found' };
  return { value: project };
};

export const listTasks = async (req: Request, res: Response) => {
  try {
    const tasks = await findTasksByOwner(getUserId(req));
    return res.json({ tasks });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const createTaskHandler = async (req: Request, res: Response) => {
  // Express 5 leaves req.body undefined when no JSON body is sent.
  const { title, description, status, priority, dueDate, project } = req.body ?? {};

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
    const resolved = await resolveProject(getUserId(req), project);
    if ('error' in resolved) return res.status(400).json({ message: resolved.error });

    const task = await createTask(getUserId(req), {
      title: title.trim(),
      description,
      status,
      priority,
      dueDate,
      ...(resolved.value !== undefined && { project: resolved.value }),
    });
    return res.status(201).json({ task });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const updateTaskHandler = async (req: Request<TaskParams>, res: Response) => {
  // Express 5 leaves req.body undefined when no JSON body is sent.
  const { title, description, status, priority, dueDate, project } = req.body ?? {};

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
    const resolved = await resolveProject(getUserId(req), project);
    if ('error' in resolved) return res.status(400).json({ message: resolved.error });
    if (resolved.value !== undefined) updates.project = resolved.value;

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
