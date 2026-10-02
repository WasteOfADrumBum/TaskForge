import { useState } from 'react';
import { createProject, deleteProject, updateProject } from '../api/projects';
import { toaster } from '../components/ui/toaster';
import { useAppDispatch, useAppSelector } from '../redux/hooks/typedHooks';
import { addProject, removeProject, replaceProject } from '../redux/slices/projectSlice';
import { getProjectId, type Project, type ProjectInput } from '../types/project';
import { SessionExpiredError } from '../utils/session';

// Create, update, and delete projects with the same toast, error, and session-expiry handling
// the Work page uses for tasks. Errors are kept per page; a 401 signs out silently.
export const useProjectActions = () => {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (failure: unknown, fallback: string, title: string) => {
    if (failure instanceof SessionExpiredError) return;
    const message = failure instanceof Error ? failure.message : fallback;
    setError(message);
    toaster.create({ title, description: message, type: 'error' });
  };

  // Creates a project, or, when `existing` is given, updates it with only the fields that
  // changed. An edit with no changes sends nothing, so it can't bump `updatedAt` or add a
  // misleading "updated" entry to the project's activity.
  const save = async (input: ProjectInput, existing?: Project): Promise<Project | null> => {
    if (!token) return null;
    const projectId = existing ? getProjectId(existing) : undefined;
    const changes: Partial<ProjectInput> = {};
    if (existing) {
      if (input.name !== existing.name) changes.name = input.name;
      if ((input.description ?? '') !== existing.description)
        changes.description = input.description;
      if (input.status && input.status !== existing.status) changes.status = input.status;
      if (Object.keys(changes).length === 0) return existing;
    }
    setSaving(true);
    setError(null);
    try {
      const project = projectId
        ? await updateProject(token, projectId, changes)
        : await createProject(token, input);
      dispatch(projectId ? replaceProject(project) : addProject(project));
      toaster.create({
        title: projectId ? 'Project Updated' : 'Project Created',
        description: project.name,
        type: 'success',
      });
      return project;
    } catch (saveError) {
      fail(saveError, 'Unable to save project', 'Project Error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const remove = async (project: Project): Promise<boolean> => {
    if (!token) return false;
    const projectId = getProjectId(project);
    setSaving(true);
    setError(null);
    try {
      await deleteProject(token, projectId);
      dispatch(removeProject(projectId));
      toaster.create({ title: 'Project Deleted', description: project.name, type: 'success' });
      return true;
    } catch (deleteError) {
      fail(deleteError, 'Unable to delete project', 'Delete Failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { save, remove, saving, error, clearError: () => setError(null) };
};
