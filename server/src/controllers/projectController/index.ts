import type { Request, Response } from 'express';
import {
  PROJECT_DESCRIPTION_MAX,
  PROJECT_NAME_MAX,
  PROJECT_STATUSES,
} from '../../models/projectModel';
import {
  createProject,
  deleteProjectById,
  findProjectById,
  findProjectsByOwner,
  updateProjectById,
  type ProjectUpdate,
} from '../../services/projectService';
import { isObjectIdString } from '../../utils/objectId';

type ProjectParams = { id: string };

const getUserId = (req: Request) => req.userId as string;
const notFound = (res: Response) => res.status(404).json({ message: 'Project not found' });

// Returns an error message for invalid input, or null when the fields that are present are valid.
const validateProjectFields = (body: Record<string, unknown>, requireName: boolean) => {
  const { name, description, status } = body;
  if (requireName || name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) return 'Project name is required';
    if (name.trim().length > PROJECT_NAME_MAX) return 'Project name is too long';
  }
  if (description !== undefined) {
    if (typeof description !== 'string') return 'Invalid project description';
    if (description.trim().length > PROJECT_DESCRIPTION_MAX)
      return 'Project description is too long';
  }
  if (status !== undefined && !PROJECT_STATUSES.includes(status as never)) {
    return 'Invalid project status';
  }
  return null;
};

export const listProjects = async (req: Request, res: Response) => {
  try {
    const projects = await findProjectsByOwner(getUserId(req));
    return res.json({ projects });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const getProjectHandler = async (req: Request<ProjectParams>, res: Response) => {
  if (!isObjectIdString(req.params.id)) return notFound(res);
  try {
    const project = await findProjectById(getUserId(req), req.params.id);
    if (!project) return notFound(res);
    return res.json({ project });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const createProjectHandler = async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const error = validateProjectFields(body, true);
  if (error) return res.status(400).json({ message: error });

  try {
    const project = await createProject(getUserId(req), {
      name: (body.name as string).trim(),
      description: body.description as string | undefined,
      status: body.status as ProjectUpdate['status'],
    });
    return res.status(201).json({ project });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const updateProjectHandler = async (req: Request<ProjectParams>, res: Response) => {
  if (!isObjectIdString(req.params.id)) return notFound(res);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const error = validateProjectFields(body, false);
  if (error) return res.status(400).json({ message: error });

  const updates: ProjectUpdate = {};
  if (body.name !== undefined) updates.name = (body.name as string).trim();
  if (body.description !== undefined) updates.description = body.description as string;
  if (body.status !== undefined) updates.status = body.status as ProjectUpdate['status'];

  try {
    const project = await updateProjectById(getUserId(req), req.params.id, updates);
    if (!project) return notFound(res);
    return res.json({ project });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};

export const deleteProjectHandler = async (req: Request<ProjectParams>, res: Response) => {
  if (!isObjectIdString(req.params.id)) return notFound(res);
  try {
    const project = await deleteProjectById(getUserId(req), req.params.id);
    if (!project) return notFound(res);
    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
};
