import { isCurrentSession } from '../../api/authenticatedFetch';
import { Badge, Button, Grid, Stack } from '@onesmall/ui';
import { useMemo, useState, type ReactNode } from 'react';
import { LuArrowLeft, LuBotOff, LuListChecks, LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import AgentForm from '../../components/agents/AgentForm';
import ApprovalPanel from '../../components/runs/ApprovalPanel';
import AgentStatusBadge from '../../components/agents/AgentStatusBadge';
import DeleteAgentDialog from '../../components/agents/DeleteAgentDialog';
import SkillTags from '../../components/agents/SkillTags';
import EmptyState from '../../components/common/EmptyState';
import SectionHeader from '../../components/common/SectionHeader';
import PriorityTaskRow from '../../components/tasks/PriorityTaskRow';
import { useAgentActions } from '../../hooks/useAgentActions';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import { AGENT_PERMISSIONS, getAgentId, type Agent } from '../../types/agent';
import { getProjectId } from '../../types/project';
import { getTaskId } from '../../types/task';
import { getTasksForAgent } from '../../utils/assignees';
import styles from './AgentDetail.module.css';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

// Assigned tasks: in progress first, then to do, then done.
const statusOrder = { 'in-progress': 0, todo: 1, done: 2 } as const;

const BackLink = () => (
  <RouterLink
    to="/workforce"
    className="tf-quiet-link os-text-sm os-inline-flex os-items-center os-gap-1"
  >
    <LuArrowLeft aria-hidden="true" />
    All agents
  </RouterLink>
);

const panelClass = 'tf-panel os-p-4 md:os-p-5 os-min-w-0';

const AgentDetailPage = () => {
  const token = useAppSelector((state) => state.auth.token);
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const agents = useAppSelector((state) => state.agents.items);
  const loaded = useAppSelector((state) => state.agents.loaded);
  const loadError = useAppSelector((state) => state.agents.error);
  const {
    items: tasks,
    loaded: tasksLoaded,
    loading: tasksLoading,
    error: tasksError,
  } = useAppSelector((state) => state.tasks);
  const tasksReady = tasksLoaded && !tasksLoading && !tasksError;
  const projects = useAppSelector((state) => state.projects.items);
  const { save, remove, saving, error, clearError } = useAgentActions();
  const [editing, setEditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);

  const agent = agents.find((item) => getAgentId(item) === id);
  const assignedTasks = useMemo(
    () => getTasksForAgent(tasks, id).sort((a, b) => statusOrder[a.status] - statusOrder[b.status]),
    [tasks, id],
  );
  const openAssigned = assignedTasks.filter((task) => task.status !== 'done').length;
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [getProjectId(project), project])),
    [projects],
  );

  // Loading, load-error, and not-found states share the page layout: back link and heading.
  const statePage = (heading: string, body: ReactNode) => (
    <div>
      <div className="os-mb-6">
        <BackLink />
        <h1 className="tf-h1 os-mt-3 os-mb-0">{heading}</h1>
      </div>
      {body}
    </div>
  );

  if (!loaded) {
    return statePage(
      'Agent',
      loadError ? (
        <div className="tf-callout-danger os-p-3">
          <p className="os-text-danger os-m-0">{loadError}</p>
        </div>
      ) : (
        <p className="os-text-muted os-m-0">Loading agent...</p>
      ),
    );
  }

  if (!agent) {
    return statePage(
      'Agent not found',
      <div className="tf-panel">
        <EmptyState
          icon={<LuBotOff size={24} />}
          title="This agent doesn't exist"
          description="It may have been deleted, or the link is wrong."
        />
      </div>,
    );
  }

  const handleSubmit = async (input: Parameters<typeof save>[0]) => {
    if (!token || !isCurrentSession(token, sessionVersion)) return false;
    const saved = await save(input, agent);
    if (!isCurrentSession(token, sessionVersion)) return false;
    if (saved) setEditing(false);
    return Boolean(saved);
  };
  const confirmDelete = async () => {
    if (!token || !isCurrentSession(token, sessionVersion) || !deleteTarget) return;
    const deleted = await remove(deleteTarget);
    if (isCurrentSession(token, sessionVersion) && deleted) {
      setDeleteTarget(null);
      navigate('/workforce');
    }
  };

  return (
    <div>
      <div className="os-mb-6">
        <BackLink />
        <div className="os-flex os-flex-wrap os-items-center os-gap-3 os-mt-3">
          <h1 className="tf-h1 os-m-0 os-min-w-0 os-text-break">{agent.name}</h1>
          <AgentStatusBadge status={agent.status} />
        </div>
        <p className="os-text-accent os-mt-1 os-mb-0">{agent.role}</p>
        {agent.description && (
          <p className={'os-text-muted os-mt-2 os-mb-0 ' + styles.preWrap}>{agent.description}</p>
        )}
        <div className="os-flex os-flex-wrap os-items-center os-gap-2 os-mt-4">
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
            Edit agent
          </Button>
          {agent.status === 'active' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/work', { state: { newTask: Date.now(), agentId: id } })}
              leftIcon={<LuPlus />}
            >
              Assign a new task
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            color="danger"
            onClick={() => setDeleteTarget(agent)}
            leftIcon={<LuTrash2 />}
          >
            Delete
          </Button>
        </div>
      </div>

      {editing && (
        <div className={'os-mb-6 ' + styles.formWrap}>
          <AgentForm
            agent={agent}
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
          <section className={panelClass} aria-labelledby="agent-assignments-heading">
            <SectionHeader
              id="agent-assignments-heading"
              title="Assigned tasks"
              count={tasksReady ? assignedTasks.length : undefined}
              action={{ label: 'Open Work', to: '/work' }}
            />
            {agent.status !== 'active' && (
              <p className="os-text-sm os-text-muted os-mt-0 os-mb-3">
                This agent is {agent.status}. It keeps existing assignments but can’t take new ones.
              </p>
            )}
            {!tasksReady ? (
              <div>
                <p className={(tasksError ? 'os-text-danger' : 'os-text-muted') + ' os-m-0'}>
                  {tasksError ? 'Assigned tasks unavailable.' : 'Loading assigned tasks...'}
                </p>
                {tasksError && (
                  <p className="os-text-danger os-text-sm os-mt-1 os-mb-0">{tasksError}</p>
                )}
              </div>
            ) : assignedTasks.length ? (
              <ul className="os-list-unstyled os-m-0" aria-label="Assigned tasks">
                {assignedTasks.map((task) => (
                  <PriorityTaskRow
                    key={getTaskId(task)}
                    task={task}
                    project={task.project ? projectsById.get(task.project) : undefined}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<LuListChecks size={24} />}
                title="No assigned tasks"
                description={
                  agent.status === 'active'
                    ? 'Assign a task from Work, or use “Assign a new task”. Assigning records who owns the work; the agent doesn’t run it.'
                    : 'Only active agents can take new tasks.'
                }
              />
            )}
          </section>

          <section className={panelClass} aria-labelledby="agent-skills-heading">
            <SectionHeader id="agent-skills-heading" title="Skills" count={agent.skills.length} />
            <SkillTags skills={agent.skills} />
          </section>

          <section className={panelClass} aria-labelledby="agent-permissions-heading">
            <SectionHeader
              id="agent-permissions-heading"
              title="Permissions"
              count={agent.permissions.length}
            />
            <p className="os-text-sm os-text-muted os-mt-0 os-mb-3">
              Drafts require Read tasks and Draft artifacts. Update permissions do not enable
              automatic changes.
            </p>
            <ul className="os-list-unstyled os-m-0">
              {AGENT_PERMISSIONS.map((item) => {
                const granted = agent.permissions.includes(item.id);
                return (
                  <li
                    key={item.id}
                    className="os-flex os-justify-between os-items-center os-gap-3 os-py-2 os-border-top"
                  >
                    <div className="os-min-w-0">
                      {/* Full-strength text either way: dimming failed contrast (KAN-76), and the
                          badge already names the state in words. */}
                      <p className="os-text-sm os-font-medium os-m-0">{item.label}</p>
                      <p className="os-text-xs os-text-muted os-m-0">
                        {item.id} · {item.description}
                      </p>
                    </div>
                    <Badge
                      size="sm"
                      variant={granted ? 'soft' : 'outline'}
                      color={granted ? 'primary' : 'neutral'}
                      className="os-shrink-0"
                    >
                      {granted ? 'Allowed' : 'Not allowed'}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </section>

          <ApprovalPanel key={id + ':' + sessionVersion} agentId={id} />

          <section className={panelClass} aria-labelledby="agent-runs-heading">
            <SectionHeader id="agent-runs-heading" title="Run activity" />
            <p className="os-text-sm os-text-muted os-mt-0 os-mb-3">
              View recorded attempts, results, context and review decisions. Assignment alone starts
              no work.
            </p>
            <RouterLink to="/workforce/runs">View run activity</RouterLink>
          </section>
        </Stack>

        <section className={panelClass} aria-labelledby="agent-details-heading">
          <SectionHeader id="agent-details-heading" title="Details" />
          <dl className="os-grid os-gap-4 os-m-0">
            {[
              ['Status', <AgentStatusBadge key="status" status={agent.status} />],
              ['Role', agent.role],
              [
                'Assigned tasks',
                tasksReady
                  ? `${assignedTasks.length} (${openAssigned} open)`
                  : tasksError
                    ? 'Unavailable'
                    : 'Loading...',
              ],
              ['Created', agent.createdAt ? dateFormat.format(new Date(agent.createdAt)) : '—'],
              ['Updated', agent.updatedAt ? dateFormat.format(new Date(agent.updatedAt)) : '—'],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="os-text-xs os-text-muted os-font-normal">{label}</dt>
                <dd className="os-font-semibold os-m-0 os-text-break">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </Grid>

      <DeleteAgentDialog
        agent={deleteTarget}
        assignedCount={tasksReady ? assignedTasks.length : null}
        loading={saving}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
};

export default AgentDetailPage;
