import { Project, PROJECT_STATUSES } from '../../models/projectModel';
import { Task } from '../../models/taskModel';

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ProjectInput {
  name: string;
  description?: string;
  status?: ProjectStatus;
}

export type ProjectUpdate = Partial<ProjectInput>;

// Every query is scoped to the owner, so one user can never read or change another's projects.

export const createProject = async (ownerId: string, projectData: ProjectInput) => {
  return Project.create({ ...projectData, owner: ownerId });
};

export const findProjectsByOwner = async (ownerId: string) => {
  return Project.find({ owner: ownerId }).sort({ updatedAt: -1 });
};

export const findProjectById = async (ownerId: string, projectId: string) => {
  return Project.findOne({ _id: projectId, owner: ownerId });
};

export const ownsProject = async (ownerId: string, projectId: string) => {
  return (await Project.exists({ _id: projectId, owner: ownerId })) !== null;
};

export const updateProjectById = async (
  ownerId: string,
  projectId: string,
  updates: ProjectUpdate,
) => {
  return Project.findOneAndUpdate({ _id: projectId, owner: ownerId }, updates, {
    new: true,
    runValidators: true,
  });
};

// Deleting a project never deletes its tasks; they become unassigned.
// 1. Unassign first: if the delete then fails, the project still exists with no tasks
//    pointing at it, and the request can simply be retried.
// 2. Delete the project.
// 3. Unassign again, best-effort, to catch a task the same user assigned to this project in
//    the moment between steps 1 and 2. Without a transaction this narrows that window rather
//    than closing it, so the client also treats a reference to an unknown project as
//    Unassigned.
export const deleteProjectById = async (ownerId: string, projectId: string) => {
  const project = await Project.findOne({ _id: projectId, owner: ownerId });
  if (!project) return null;
  const unassign = () =>
    Task.updateMany({ owner: ownerId, project: projectId }, { $set: { project: null } });
  await unassign();
  await Project.deleteOne({ _id: projectId, owner: ownerId });
  try {
    await unassign();
  } catch {
    // The project is already gone; a failed cleanup must not turn a successful delete into
    // an error. Any straggler is shown as Unassigned by the client.
  }
  return project;
};
