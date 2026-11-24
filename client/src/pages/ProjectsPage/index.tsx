import { isCurrentSession } from '../../api/authenticatedFetch';
import { Grid } from '@onesmall/ui';
import { useMemo, useState } from 'react';
import { LuFolderKanban } from 'react-icons/lu';
import EmptyState from '../../components/common/EmptyState';
import DeleteProjectDialog from '../../components/projects/DeleteProjectDialog';
import ProjectCard from '../../components/projects/ProjectCard';
import ProjectForm from '../../components/projects/ProjectForm';
import workStyles from '../../components/work/Work.module.css';
import WorkTabs from '../../components/work/WorkTabs';
import { useProjectActions } from '../../hooks/useProjectActions';
import { useToday } from '../../hooks/useToday';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import { getProjectId, type Project } from '../../types/project';
import { getProjectStats, getStatsForProject, sortProjects } from '../../utils/projects';

const ProjectsPage = () => {
  const token = useAppSelector((state) => state.auth.token);
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  const projects = useAppSelector((state) => state.projects.items);
  const loading = useAppSelector((state) => state.projects.loading);
  const loaded = useAppSelector((state) => state.projects.loaded);
  const loadError = useAppSelector((state) => state.projects.error);
  const tasks = useAppSelector((state) => state.tasks.items);
  const today = useToday();
  const { save, remove, saving, error, clearError } = useProjectActions();
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const sorted = useMemo(() => sortProjects(projects), [projects]);
  const stats = useMemo(() => getProjectStats(tasks, today), [tasks, today]);

  const startEdit = (project: Project) => {
    clearError();
    setEditing(project);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const cancelEdit = () => {
    clearError();
    setEditing(null);
  };
  const handleSubmit = async (input: Parameters<typeof save>[0]) => {
    if (!token || !isCurrentSession(token, sessionVersion)) return false;
    const saved = await save(input, editing ?? undefined);
    if (!isCurrentSession(token, sessionVersion)) return false;
    if (saved && editing) setEditing(null);
    return Boolean(saved);
  };
  const confirmDelete = async () => {
    if (!token || !isCurrentSession(token, sessionVersion) || !deleteTarget) return;
    const deleted = await remove(deleteTarget);
    if (!isCurrentSession(token, sessionVersion) || !deleted) return;
    if (editing && getProjectId(editing) === getProjectId(deleteTarget)) setEditing(null);
    setDeleteTarget(null);
  };

  return (
    <div>
      <div className={workStyles.pageHeader}>
        <p className={workStyles.eyebrow}>Work</p>
        <h1 className="tf-h1 os-m-0 os-mt-1">Projects</h1>
        <p className="os-text-muted os-mt-1 os-mb-0">
          Group related tasks and track progress toward a goal.
        </p>
      </div>
      <WorkTabs />
      <Grid columns={{ base: 1, xl: 3 }} gap={6} className="os-items-start">
        <ProjectForm
          key={editing ? getProjectId(editing) : 'new'}
          project={editing ?? undefined}
          saving={saving}
          error={error}
          onSubmit={handleSubmit}
          onCancel={editing ? cancelEdit : undefined}
        />
        <section aria-labelledby="project-list-heading" className="xl:os-col-span-2 os-min-w-0">
          <h2 id="project-list-heading" className="tf-h2 os-m-0 os-mb-1">
            Your Projects
          </h2>
          <p className={'os-text-muted os-text-sm os-mt-0 os-mb-4 ' + workStyles.reserveLine}>
            {loaded && `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`}
          </p>
          {loadError && (
            <div className="tf-callout-danger os-p-3 os-mb-4">
              <p className="os-text-danger os-m-0">{loadError}</p>
            </div>
          )}
          {!loaded && loading && (
            <div className="tf-panel os-p-8 os-text-center">
              <p className="os-text-muted os-m-0 os-max-w-none">Loading your projects...</p>
            </div>
          )}
          {loaded && projects.length === 0 && (
            <div className="tf-panel">
              <EmptyState
                icon={<LuFolderKanban size={24} />}
                title="No projects yet"
                description="Create a project to group related tasks and see progress at a glance."
              />
            </div>
          )}
          {projects.length > 0 && (
            <Grid
              as="ul"
              columns={{ base: 1, md: 2 }}
              gap={4}
              className="os-list-unstyled os-m-0 os-p-0"
            >
              {sorted.map((project) => (
                <ProjectCard
                  key={getProjectId(project)}
                  project={project}
                  stats={getStatsForProject(stats, getProjectId(project))}
                  onEdit={startEdit}
                  onDelete={setDeleteTarget}
                />
              ))}
            </Grid>
          )}
        </section>
      </Grid>
      <DeleteProjectDialog
        project={deleteTarget}
        taskCount={deleteTarget ? getStatsForProject(stats, getProjectId(deleteTarget)).total : 0}
        loading={saving}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
};

export default ProjectsPage;
