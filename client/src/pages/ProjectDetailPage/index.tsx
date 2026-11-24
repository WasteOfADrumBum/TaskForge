import { isCurrentSession } from '../../api/authenticatedFetch';
import { Button, Grid, Progress, Stack } from '@onesmall/ui';
import { useMemo, useState, type ReactNode } from 'react';
import {
  LuArrowLeft,
  LuClock,
  LuFolderX,
  LuInbox,
  LuPencil,
  LuPlus,
  LuTrash2,
} from 'react-icons/lu';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import EmptyState from '../../components/common/EmptyState';
import SectionHeader from '../../components/common/SectionHeader';
import DeleteProjectDialog from '../../components/projects/DeleteProjectDialog';
import ProjectForm from '../../components/projects/ProjectForm';
import ProjectStatusBadge from '../../components/projects/ProjectStatusBadge';
import PriorityTaskRow from '../../components/tasks/PriorityTaskRow';
import workStyles from '../../components/work/Work.module.css';
import WorkTabs from '../../components/work/WorkTabs';
import { useProjectActions } from '../../hooks/useProjectActions';
import { useToday } from '../../hooks/useToday';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import { getProjectId, type Project } from '../../types/project';
import { getTaskId } from '../../types/task';
import {
  getProjectActivity,
  getProjectStats,
  getStatsForProject,
  getTasksForProject,
} from '../../utils/projects';
import styles from './ProjectDetail.module.css';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const statusOrder = { 'in-progress': 0, todo: 1, done: 2 } as const;

const BackLink = () => (
  <RouterLink to="/work/projects" className={styles.backLink}>
    <LuArrowLeft aria-hidden="true" />
    All projects
  </RouterLink>
);

const ProjectDetailPage = () => {
  const token = useAppSelector((state) => state.auth.token);
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const projects = useAppSelector((state) => state.projects.items);
  const loaded = useAppSelector((state) => state.projects.loaded);
  const loadError = useAppSelector((state) => state.projects.error);
  const tasks = useAppSelector((state) => state.tasks.items);
  const today = useToday();
  const { save, remove, saving, error, clearError } = useProjectActions();
  const [editing, setEditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const project = projects.find((item) => getProjectId(item) === id);
  const stats = useMemo(
    () => getStatsForProject(getProjectStats(tasks, today), id),
    [tasks, today, id],
  );
  const projectTasks = useMemo(
    () =>
      getTasksForProject(tasks, id).sort((a, b) => statusOrder[a.status] - statusOrder[b.status]),
    [tasks, id],
  );
  const activity = useMemo(
    () => (project ? getProjectActivity(project, tasks) : []),
    [project, tasks],
  );

  // Loading, load-error, and not-found states share the page layout: back link, heading, tabs.
  const statePage = (heading: string, body: ReactNode) => (
    <div>
      <div className={workStyles.pageHeader}>
        <BackLink />
        <h1 className="tf-h1 os-m-0 os-mt-3">{heading}</h1>
      </div>
      <WorkTabs />
      {body}
    </div>
  );

  if (!loaded) {
    return statePage(
      'Project',
      loadError ? (
        <div className="tf-callout-danger os-p-3">
          <p className="os-text-danger os-m-0">{loadError}</p>
        </div>
      ) : (
        <p className="os-text-muted os-m-0">Loading project...</p>
      ),
    );
  }

  if (!project) {
    return statePage(
      'Project not found',
      <div className="tf-panel">
        <EmptyState
          icon={<LuFolderX size={24} />}
          title="This project doesn't exist"
          description="It may have been deleted, or the link is wrong."
        />
      </div>,
    );
  }

  const handleSubmit = async (input: Parameters<typeof save>[0]) => {
    if (!token || !isCurrentSession(token, sessionVersion)) return false;
    const saved = await save(input, project);
    if (!isCurrentSession(token, sessionVersion)) return false;
    if (saved) setEditing(false);
    return Boolean(saved);
  };
  const confirmDelete = async () => {
    if (!token || !isCurrentSession(token, sessionVersion) || !deleteTarget) return;
    const deleted = await remove(deleteTarget);
    if (isCurrentSession(token, sessionVersion) && deleted) {
      setDeleteTarget(null);
      navigate('/work/projects');
    }
  };

  return (
    <div>
      <div className={workStyles.pageHeader}>
        <BackLink />
        <div className="os-flex os-flex-wrap os-items-center os-gap-3 os-mt-3">
          <h1 className={'tf-h1 os-m-0 ' + styles.title}>{project.name}</h1>
          <ProjectStatusBadge status={project.status} />
        </div>
        {project.description && (
          <p className={'os-text-muted os-mt-2 os-mb-0 ' + styles.description}>
            {project.description}
          </p>
        )}
        <div className="os-flex os-flex-wrap os-gap-2 os-mt-4">
          <Button
            size="sm"
            color="primary"
            onClick={() => navigate('/work', { state: { newTask: Date.now(), projectId: id } })}
            leftIcon={<LuPlus />}
          >
            New task in project
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              clearError();
              setEditing(true);
            }}
            disabled={editing}
            leftIcon={<LuPencil />}
          >
            Edit project
          </Button>
          <Button
            size="sm"
            variant="ghost"
            color="danger"
            onClick={() => setDeleteTarget(project)}
            leftIcon={<LuTrash2 />}
          >
            Delete
          </Button>
        </div>
      </div>
      <WorkTabs />

      {editing && (
        <div className={'os-mb-6 ' + styles.formWrap}>
          <ProjectForm
            project={project}
            saving={saving}
            error={error}
            onSubmit={handleSubmit}
            onCancel={() => {
              clearError();
              setEditing(false);
            }}
          />
        </div>
      )}

      <Grid columns={{ base: 1, xl: 3 }} gap={6} className="os-items-start">
        <Stack gap={6} className="xl:os-col-span-2 os-min-w-0">
          <section aria-labelledby="project-tasks-heading" className="tf-panel os-p-4 md:os-p-5">
            <SectionHeader
              id="project-tasks-heading"
              title="Tasks"
              count={projectTasks.length}
              action={{ label: 'Open Work', to: '/work' }}
            />
            {projectTasks.length ? (
              <ul className="os-list-unstyled os-m-0 os-p-0">
                {projectTasks.map((task) => (
                  <PriorityTaskRow key={getTaskId(task)} task={task} />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<LuInbox size={24} />}
                title="No tasks in this project yet"
                description="Add one with “New task in project”, or pick this project when editing a task."
              />
            )}
          </section>

          <section aria-labelledby="project-activity-heading" className="tf-panel os-p-4 md:os-p-5">
            <SectionHeader id="project-activity-heading" title="Recent activity" />
            {activity.length ? (
              <ol className="os-list-unstyled os-m-0 os-p-0">
                {activity.map((item) => (
                  <li key={item.id} className={styles.activityItem}>
                    <div className={styles.marker} data-kind={item.kind} aria-hidden="true" />
                    <div className="os-min-w-0">
                      <p className="os-text-sm os-line-clamp-2 os-m-0">{item.label}</p>
                      <p className="os-text-xs os-text-muted os-m-0">
                        <time dateTime={item.at}>{timeFormat.format(new Date(item.at))}</time>
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState icon={<LuClock size={24} />} title="No activity yet" />
            )}
          </section>
        </Stack>

        <section
          aria-labelledby="project-details-heading"
          className="tf-panel os-p-4 md:os-p-5 os-min-w-0"
        >
          <SectionHeader id="project-details-heading" title="Details" />
          <div className="os-flex os-justify-between os-mb-2 os-text-sm">
            <span className="os-text-muted">Completion</span>
            <span>{stats.completion}%</span>
          </div>
          <Progress
            value={stats.completion}
            size="sm"
            color="primary"
            label={project.name + ' completion'}
            hideLabel
          />
          <Grid as="dl" columns={2} gap={4} className="os-mt-5 os-mb-0">
            {[
              ['Open tasks', String(stats.open)],
              ['Done', String(stats.done)],
              ['In progress', String(stats.inProgress)],
              ['Overdue', String(stats.overdue)],
              ['Created', project.createdAt ? dateFormat.format(new Date(project.createdAt)) : '—'],
              ['Updated', project.updatedAt ? dateFormat.format(new Date(project.updatedAt)) : '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="os-text-xs os-text-muted">{label}</dt>
                <dd className="os-font-semibold os-m-0">{value}</dd>
              </div>
            ))}
          </Grid>
        </section>
      </Grid>

      <DeleteProjectDialog
        project={deleteTarget}
        taskCount={stats.total}
        loading={saving}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
};

export default ProjectDetailPage;
