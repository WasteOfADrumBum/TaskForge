import { isCurrentSession } from '../../api/authenticatedFetch';
import { Alert, AlertLink, Grid } from '@onesmall/ui';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { LuBot } from 'react-icons/lu';
import AgentCard from '../../components/agents/AgentCard';
import AgentForm from '../../components/agents/AgentForm';
import DeleteAgentDialog from '../../components/agents/DeleteAgentDialog';
import EmptyState from '../../components/common/EmptyState';
import { useAgentActions } from '../../hooks/useAgentActions';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import { getAgentId, type Agent } from '../../types/agent';
import { getAgentSummary, sortAgents } from '../../utils/agents';
import { getAgentWorkloads, getWorkloadFor } from '../../utils/assignees';
import styles from './Workforce.module.css';

const phase2Url =
  'https://github.com/WasteOfADrumBum/TaskForge/blob/main/docs/phases/phase-2-ai-workforce.md';

// The Agent Registry: persistent, user-owned agent definitions. Nothing here runs an agent.
const WorkforcePage = () => {
  const token = useAppSelector((state) => state.auth.token);
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  const agents = useAppSelector((state) => state.agents.items);
  const loading = useAppSelector((state) => state.agents.loading);
  const loaded = useAppSelector((state) => state.agents.loaded);
  const loadError = useAppSelector((state) => state.agents.error);
  const {
    items: tasks,
    loaded: tasksLoaded,
    loading: tasksLoading,
    error: tasksError,
  } = useAppSelector((state) => state.tasks);
  const tasksReady = tasksLoaded && !tasksLoading && !tasksError;
  const { save, remove, saving, error, clearError } = useAgentActions();
  const [editing, setEditing] = useState<Agent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);

  const sorted = useMemo(() => sortAgents(agents), [agents]);
  const summary = useMemo(() => getAgentSummary(agents), [agents]);
  // Derived from the tasks already loaded by the shell; no extra request.
  const workloads = useMemo(() => getAgentWorkloads(tasks), [tasks]);

  const startEdit = (agent: Agent) => {
    clearError();
    setEditing(agent);
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
    if (editing && getAgentId(editing) === getAgentId(deleteTarget)) setEditing(null);
    setDeleteTarget(null);
  };

  return (
    <div>
      <div className="os-mb-6">
        <p className="os-text-accent os-text-xs os-font-semibold os-text-upper os-tracking-wider os-m-0">
          Agent Registry
        </p>
        <h1 className="tf-h1 os-mt-2 os-mb-0">Workforce</h1>
        <p className="os-text-muted os-mt-2 os-mb-0">
          Define the AI workers you plan to use: their role, skills, and permissions.
        </p>
      </div>
      <RouterLink to="/workforce/runs" className="os-inline-flex os-mb-4">
        Run activity
      </RouterLink>
      <Alert color="info" title="Assignments do not start runs." className="os-mb-6">
        You can assign tasks to active agents to plan who owns what. Assignment alone does not start
        a run or call a model. Choose a run and an execution mode explicitly. Review pending drafts
        before approving them. Read the{' '}
        <AlertLink href={phase2Url} target="_blank" rel="noreferrer">
          Phase 2 plan
        </AlertLink>
        .
      </Alert>
      <Grid columns={{ base: 1, xl: 3 }} gap={6} className="os-items-start">
        <AgentForm
          key={editing ? getAgentId(editing) : 'new'}
          agent={editing ?? undefined}
          saving={saving}
          error={error}
          onSubmit={handleSubmit}
          onCancel={editing ? cancelEdit : undefined}
        />
        <section aria-labelledby="agent-list-heading" className="xl:os-col-span-2 os-min-w-0">
          <h2 id="agent-list-heading" className="tf-h2 os-mt-0 os-mb-1">
            Your Agents
          </h2>
          <p className={'os-text-muted os-text-sm os-mt-0 os-mb-4 ' + styles.summary}>
            {loaded &&
              `${summary.total} ${summary.total === 1 ? 'agent' : 'agents'}` +
                (summary.total ? ` · ${summary.active} active` : '')}
          </p>
          {loadError && (
            <div className="tf-callout-danger os-p-3 os-mb-4">
              <p className="os-text-danger os-m-0">{loadError}</p>
            </div>
          )}
          {!loaded && loading && (
            <div className="tf-panel os-p-8 os-text-center">
              <p className="os-text-muted os-m-0">Loading your agents...</p>
            </div>
          )}
          {loaded && agents.length === 0 && (
            <div className="tf-panel">
              <EmptyState
                icon={<LuBot size={24} />}
                title="No agents yet"
                description="Create an agent to record its role, skills, and permissions, then assign it tasks. It won’t run anything yet."
              />
            </div>
          )}
          {agents.length > 0 && (
            <Grid as="ul" columns={{ base: 1, md: 2 }} gap={4} className="os-list-unstyled os-m-0">
              {sorted.map((agent) => (
                <AgentCard
                  key={getAgentId(agent)}
                  agent={agent}
                  workload={tasksReady ? getWorkloadFor(workloads, getAgentId(agent)) : null}
                  workloadMessage={
                    tasksError ? 'Assigned tasks unavailable.' : 'Loading assigned tasks...'
                  }
                  onEdit={startEdit}
                  onDelete={setDeleteTarget}
                />
              ))}
            </Grid>
          )}
        </section>
      </Grid>
      <DeleteAgentDialog
        agent={deleteTarget}
        assignedCount={
          tasksReady && deleteTarget
            ? getWorkloadFor(workloads, getAgentId(deleteTarget)).total
            : null
        }
        loading={saving}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
};

export default WorkforcePage;
