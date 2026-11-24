import { Badge, Progress, Stack } from '@onesmall/ui';
import { useMemo } from 'react';
import {
  LuCircleCheck,
  LuClock,
  LuListTodo,
  LuLoaderCircle,
  LuSignpost,
  LuTriangleAlert,
} from 'react-icons/lu';
import { Link as RouterLink } from 'react-router-dom';
import AgentActivityPanel from '../../components/commandCenter/AgentActivityPanel';
import EmptyState from '../../components/common/EmptyState';
import MetricCard from '../../components/common/MetricCard';
import SectionHeader from '../../components/common/SectionHeader';
import ProjectRiskBadge from '../../components/projects/ProjectRiskBadge';
import PriorityTaskRow from '../../components/tasks/PriorityTaskRow';
import { useGreeting } from '../../hooks/useGreeting';
import { useToday } from '../../hooks/useToday';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import { getProjectId } from '../../types/project';
import { getTaskId } from '../../types/task';
import { getAgentSummary } from '../../utils/agents';
import { getAssignmentSummary } from '../../utils/assignees';
import {
  getProjectStats,
  getStatsForProject,
  isProjectAtRisk,
  sortByRisk,
} from '../../utils/projects';
import {
  getRecentActivity,
  getRecommendations,
  getTodaysPriorities,
} from '../../utils/commandCenter';
import { getTaskSummary } from '../../utils/tasks';
import styles from './CommandCenter.module.css';

const timeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const CommandCenterPage = () => {
  const tasks = useAppSelector((state) => state.tasks.items);
  const loading = useAppSelector((state) => state.tasks.loading);
  const tasksLoaded = useAppSelector((state) => state.tasks.loaded);
  const error = useAppSelector((state) => state.tasks.error);
  // One `now` for every section, so the Overdue metric and the priorities always agree. It
  // advances when the local day changes, so a tab left open past midnight stays correct.
  const now = useToday();
  const greeting = useGreeting();
  const summary = useMemo(() => getTaskSummary(tasks, now), [tasks, now]);
  // Count from the full list; only the panel shows the top five.
  const allPriorities = useMemo(
    () => getTodaysPriorities(tasks, now, Number.POSITIVE_INFINITY),
    [tasks, now],
  );
  const priorities = allPriorities.slice(0, 5);
  const recommendations = useMemo(() => getRecommendations(tasks, now), [tasks, now]);
  const activity = useMemo(() => getRecentActivity(tasks), [tasks]);
  const projects = useAppSelector((state) => state.projects.items);
  const projectStats = useMemo(() => getProjectStats(tasks, now), [tasks, now]);
  const activeProjects = useMemo(
    () =>
      sortByRisk(
        projects.filter((project) => project.status === 'active'),
        projectStats,
      ),
    [projects, projectStats],
  );
  const agents = useAppSelector((state) => state.agents.items);
  const agentSummary = useMemo(() => getAgentSummary(agents), [agents]);
  const assignmentSummary = useMemo(() => getAssignmentSummary(tasks, agents), [tasks, agents]);
  const tasksReady = tasksLoaded && !loading && !error;
  const initialLoad = loading && tasks.length === 0;
  const open = summary.todo + summary.inProgress;
  const completion = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;
  const attention = allPriorities.filter(
    (item) => item.reason === 'overdue' || item.reason === 'due-today',
  ).length;

  return (
    <Stack gap={{ base: 6, md: 8 }}>
      <div>
        <p className={'os-text-primary os-text-xs os-font-semibold os-m-0 ' + styles.eyebrow}>
          Your daily brief
        </p>
        <h1 className="tf-h1 os-mt-2 os-mb-0">{greeting}.</h1>
        <p className="os-text-muted os-mt-2 os-mb-0">
          {initialLoad ? (
            'Loading your workspace...'
          ) : (
            <>
              {attention
                ? (attention === 1 ? '1 task needs' : attention + ' tasks need') +
                  ' your attention today.'
                : 'Nothing is overdue or due today.'}{' '}
              {open} open {open === 1 ? 'task' : 'tasks'} in your workspace.
            </>
          )}
        </p>
      </div>

      {error && (
        <div className="tf-callout-danger os-p-3">
          <p className="os-text-danger os-m-0">{error}</p>
        </div>
      )}

      <section
        aria-label="Task metrics"
        className="os-grid os-grid-cols-2 xl:os-grid-cols-4 os-gap-4"
      >
        <MetricCard
          label="Open tasks"
          value={open}
          detail={summary.todo + ' to do'}
          icon={LuListTodo}
          accent="primary"
        />
        <MetricCard
          label="In progress"
          value={summary.inProgress}
          detail="Started and not finished"
          icon={LuLoaderCircle}
          accent="accent"
        />
        <MetricCard
          label="Completed"
          value={summary.done}
          detail={completion + '% of all tasks'}
          icon={LuCircleCheck}
          accent="primary"
        />
        <MetricCard
          label="Overdue"
          value={summary.overdue}
          detail={summary.overdue ? 'Past their due date' : 'All caught up'}
          icon={LuTriangleAlert}
          accent="secondary"
        />
      </section>

      <div className="os-grid os-grid-cols-1 xl:os-grid-cols-3 os-gap-6 os-items-start">
        <Stack gap={6} className="xl:os-col-span-2 os-min-w-0">
          <section aria-labelledby="priorities-heading" className="tf-panel os-p-4 md:os-p-5">
            <SectionHeader
              id="priorities-heading"
              title="Today's priorities"
              count={allPriorities.length}
              action={{ label: 'View all work', to: '/work' }}
            />
            {initialLoad ? (
              <p className="os-text-muted os-m-0">Loading priorities...</p>
            ) : priorities.length ? (
              <ul className="os-list-unstyled os-m-0 os-p-0">
                {priorities.map(({ task, reason }) => (
                  <PriorityTaskRow key={getTaskId(task)} task={task} reason={reason} />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<LuCircleCheck size={24} />}
                title="Nothing urgent"
                description="No overdue, due-soon, or high-priority open tasks. Open Work to choose your next task."
              />
            )}
          </section>

          <section aria-labelledby="activity-heading" className="tf-panel os-p-4 md:os-p-5">
            <SectionHeader id="activity-heading" title="Recent task changes" />
            {initialLoad ? (
              <p className="os-text-muted os-m-0">Loading recent changes...</p>
            ) : activity.length ? (
              <ol className="os-list-unstyled os-m-0 os-p-0">
                {activity.map(({ task, action, at }) => (
                  <li
                    key={getTaskId(task) + at}
                    className="os-flex os-items-start os-gap-3 os-py-2 os-border-top"
                  >
                    <span
                      className={
                        styles.dot +
                        ' ' +
                        (action === 'created' ? styles.dotCreated : styles.dotUpdated)
                      }
                      aria-hidden="true"
                    />
                    <div className="os-min-w-0">
                      <p className="os-text-sm os-line-clamp-2 os-m-0">
                        {action === 'created' ? 'Created' : 'Updated'} &ldquo;{task.title}&rdquo;
                      </p>
                      <p className="os-text-xs os-text-muted os-m-0">
                        <time dateTime={at}>{timeFormat.format(new Date(at))}</time>
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                icon={<LuClock size={24} />}
                title="No activity yet"
                description="Task creations and updates will appear here."
              />
            )}
          </section>
        </Stack>

        <Stack gap={6} className="os-min-w-0">
          {activeProjects.length > 0 && (
            <section
              aria-labelledby="active-projects-heading"
              className="tf-panel os-p-4 md:os-p-5"
            >
              <SectionHeader
                id="active-projects-heading"
                title="Active projects"
                count={activeProjects.length}
                action={{ label: 'All projects', to: '/work/projects' }}
              />
              <ul className="os-list-unstyled os-m-0 os-p-0">
                {activeProjects.slice(0, 4).map((project) => {
                  const stats = getStatsForProject(projectStats, getProjectId(project));
                  return (
                    <li key={getProjectId(project)} className="os-py-3 os-border-top">
                      <div className="os-flex os-justify-between os-items-center os-gap-3 os-mb-2">
                        <RouterLink
                          to={'/work/projects/' + getProjectId(project)}
                          className={'os-text-sm os-font-medium ' + styles.projectLink}
                        >
                          <span className="os-block os-truncate">{project.name}</span>
                        </RouterLink>
                        <span className="os-text-xs os-text-muted os-shrink-0">
                          {stats.total ? `${stats.open} open` : 'No tasks'}
                        </span>
                      </div>
                      {isProjectAtRisk(project, stats) && (
                        <div className="os-mb-2">
                          <ProjectRiskBadge overdue={stats.overdue} />
                        </div>
                      )}
                      {stats.total > 0 && (
                        <Progress
                          value={stats.completion}
                          label={project.name + ' completion'}
                          hideLabel
                          size="sm"
                          height="0.25rem"
                          color="primary"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {agentSummary.total > 0 && (
            <section aria-labelledby="workforce-heading" className="tf-panel os-p-4 md:os-p-5">
              <SectionHeader
                id="workforce-heading"
                title="Workforce"
                count={agentSummary.total}
                action={{ label: 'Open Workforce', to: '/workforce' }}
              />
              <dl className="os-grid os-grid-cols-3 os-gap-3 os-text-center os-m-0">
                {[
                  { label: 'Active', value: agentSummary.active },
                  { label: 'Paused', value: agentSummary.paused },
                  { label: 'Disabled', value: agentSummary.disabled },
                ].map((item) => (
                  <div key={item.label} className={styles.tile}>
                    <dt className="os-text-xs os-text-muted">{item.label}</dt>
                    <dd className="os-text-xl os-font-semibold os-m-0">{item.value}</dd>
                  </div>
                ))}
              </dl>
              <dl className="os-mt-4 os-mb-0 os-text-sm">
                {[
                  {
                    label: 'Agents with open tasks',
                    value: assignmentSummary.agentsWithOpenTasks,
                  },
                  { label: 'Open tasks on agents', value: assignmentSummary.openOnAgents },
                  { label: 'Open tasks on you', value: assignmentSummary.openOnMe },
                  { label: 'Unassigned open tasks', value: assignmentSummary.openUnassigned },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="os-flex os-justify-between os-items-center os-gap-2 os-py-2 os-border-top"
                  >
                    <dt className="os-text-muted">{item.label}</dt>
                    <dd className="os-font-semibold os-m-0">
                      {tasksReady ? item.value : error ? 'Unavailable' : 'Loading...'}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="os-text-xs os-text-muted os-mt-3 os-mb-0">
                Assignments record who owns the work. Assignments do not start runs.
              </p>
            </section>
          )}

          {agentSummary.total > 0 && <AgentActivityPanel now={now} />}

          <section aria-labelledby="summary-heading" className="tf-panel os-p-4 md:os-p-5">
            <SectionHeader id="summary-heading" title="Task summary" />
            <Progress
              value={completion}
              label="Completion"
              showValue
              size="sm"
              color="primary"
              className="os-text-sm"
            />
            <dl className="os-grid os-grid-cols-3 os-gap-3 os-mt-5 os-mb-0 os-text-center">
              {[
                { label: 'To do', value: summary.todo },
                { label: 'In progress', value: summary.inProgress },
                { label: 'Done', value: summary.done },
              ].map((item) => (
                <div key={item.label} className={styles.tile}>
                  <dt className="os-text-xs os-text-muted">{item.label}</dt>
                  <dd className="os-text-xl os-font-semibold os-m-0">{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="recommendations-heading">
            <SectionHeader
              id="recommendations-heading"
              title="Recommended next"
              icon={<LuSignpost aria-hidden="true" />}
              aside={
                <Badge
                  color="neutral"
                  variant="outline"
                  size="sm"
                  title="Generated from task data by fixed rules"
                >
                  Rule based
                </Badge>
              }
            />
            {recommendations.length ? (
              <Stack as="ul" gap={3} className="os-list-unstyled os-m-0 os-p-0">
                {recommendations.map((item) => (
                  <li key={item.id}>
                    <RouterLink
                      to="/work"
                      className={styles.recommendation + ' ' + styles[item.tone]}
                    >
                      <p className="os-text-sm os-font-semibold os-m-0">{item.title}</p>
                      <p className="os-text-sm os-text-muted os-mt-1 os-mb-0">{item.reason}</p>
                    </RouterLink>
                  </li>
                ))}
              </Stack>
            ) : (
              <p className="os-text-muted os-text-sm os-m-0">
                No recommendations right now. Your open work is on track.
              </p>
            )}
          </section>
        </Stack>
      </div>
    </Stack>
  );
};

export default CommandCenterPage;
