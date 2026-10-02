export type ProjectStatus = 'active' | 'completed' | 'archived';

export const PROJECT_STATUSES: ProjectStatus[] = ['active', 'completed', 'archived'];

export const projectStatusLabel: Record<ProjectStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
};

// Matches server/src/models/projectModel. Keep both sides in sync.
export interface Project {
  _id?: string;
  id?: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectInput {
  name: string;
  description?: string;
  status?: ProjectStatus;
}

export type ProjectUpdate = Partial<ProjectInput>;

export const getProjectId = (project: Project) => project._id ?? project.id ?? '';
