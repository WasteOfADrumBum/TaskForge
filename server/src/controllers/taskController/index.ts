import type { Request, Response } from 'express';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../models/taskModel';
import { findAgentStatus } from '../../services/agentService';
import { ownsProject } from '../../services/projectService';
import {
  createTask,
  deleteTaskById,
  findTasksByOwner,
  isTaskAssignedToAgent,
  updateTaskById,
  type TaskInput,
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

type Assignee = Required<Pick<TaskInput, 'assigneeType' | 'assigneeAgent'>>;

const isEmpty = (value: unknown) => value === undefined || value === null || value === '';

// Resolves the optional `assigneeType`/`assigneeAgent` pair. Both undefined leaves the
// assignment unchanged. Otherwise `assigneeType` is required and decides the assignee:
// null or '' (nobody), 'user' (the task's owner; a task can't go to another user), or 'agent'
// with `assigneeAgent` set to one of the owner's agents. A missing agent and another user's
// agent get the same 400, so the API never reveals whether another user's agent exists.
// Only an active agent can take a new assignment. A paused or disabled agent keeps the tasks
// it already has, so an update may re-send a task's current agent (`taskId` is that task).
const resolveAssignee = async (
  ownerId: string,
  assigneeType: unknown,
  assigneeAgent: unknown,
  taskId?: string,
): Promise<{ value: Assignee | undefined } | { error: string }> => {
  if (assigneeType === undefined) {
    return assigneeAgent === undefined ? { value: undefined } : { error: 'Invalid assignee' };
  }
  if (isEmpty(assigneeType) || assigneeType === 'user') {
    if (!isEmpty(assigneeAgent)) return { error: 'Invalid assignee' };
    return {
      value: { assigneeType: assigneeType === 'user' ? 'user' : null, assigneeAgent: null },
    };
  }
  if (assigneeType !== 'agent') return { error: 'Invalid assignee' };
  if (!isObjectIdString(assigneeAgent)) return { error: 'Invalid agent' };
  const status = await findAgentStatus(ownerId, assigneeAgent);
  if (!status) return { error: 'Agent not found' };
  if (status !== 'active') {
    const alreadyAssigned =
      taskId !== undefined &&
      isObjectIdString(taskId) &&
      (await isTaskAssignedToAgent(ownerId, taskId, assigneeAgent));
    if (!alreadyAssigned) return { error: 'Only active agents can take new tasks' };
  }
  return { value: { assigneeType: 'agent', assigneeAgent } };
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
  const { title, description, status, priority, dueDate, project, assigneeType, assigneeAgent } =
    req.body ?? {};

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
    const assignee = await resolveAssignee(getUserId(req), assigneeType, assigneeAgent);
    if ('error' in assignee) return res.status(400).json({ message: assignee.error });

    const task = await createTask(getUserId(req), {
      title: title.trim(),
      description,
      status,
      priority,
      dueDate,
      ...(resolved.value !== undefined && { project: resolved.value }),
      ...assignee.value,
    });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    return res.status(201).json({ task });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const updateTaskHandler = async (req: Request<TaskParams>, res: Response) => {
  // Express 5 leaves req.body undefined when no JSON body is sent.
  const { title, description, status, priority, dueDate, project, assigneeType, assigneeAgent } =
    req.body ?? {};

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
    const assignee = await resolveAssignee(
      getUserId(req),
      assigneeType,
      assigneeAgent,
      req.params.id,
    );
    if ('error' in assignee) return res.status(400).json({ message: assignee.error });
    Object.assign(updates, assignee.value);

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
