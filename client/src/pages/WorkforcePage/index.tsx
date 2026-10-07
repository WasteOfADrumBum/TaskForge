import { isCurrentSession } from '../../api/authenticatedFetch';
import { Alert, Box, Heading, Link, SimpleGrid, Text } from '@chakra-ui/react';
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
    <Box>
      <Box mb={{ base: 5, md: 6 }}>
        <Text
          color="accent.violet"
          fontSize="xs"
          fontWeight="semibold"
          letterSpacing="widest"
          textTransform="uppercase"
        >
          Agent Registry
        </Text>
        <Heading as="h1" size={{ base: '2xl', md: '3xl' }} mt={1.5}>
          Workforce
        </Heading>
        <Text color="fg.muted" mt={1.5}>
          Define the AI workers you plan to use: their role, skills, and permissions.
        </Text>
      </Box>
      <Link asChild mb={4} display="inline-flex" color="accent.teal">
        <RouterLink to="/workforce/runs">Run activity</RouterLink>
      </Link>
      <Alert.Root status="info" variant="surface" mb={{ base: 5, md: 6 }}>
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Assignments do not start runs.</Alert.Title>
          <Alert.Description>
            You can assign tasks to active agents to plan who owns what. Assignment alone does not
            start a run or call a model. Choose a run and an execution mode explicitly. Review
            pending drafts before approving them. Read the{' '}
            <Link href={phase2Url} target="_blank" rel="noreferrer" textDecoration="underline">
              Phase 2 plan
            </Link>
            .
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
      <SimpleGrid columns={{ base: 1, xl: 3 }} gap={6} alignItems="start">
        <AgentForm
          key={editing ? getAgentId(editing) : 'new'}
          agent={editing ?? undefined}
          saving={saving}
          error={error}
          onSubmit={handleSubmit}
          onCancel={editing ? cancelEdit : undefined}
        />
        <Box
          as="section"
          aria-labelledby="agent-list-heading"
          gridColumn={{ xl: 'span 2' }}
          minW="0"
        >
          <Heading as="h2" id="agent-list-heading" size="lg" mb={1}>
            Your Agents
          </Heading>
          <Text color="fg.muted" fontSize="sm" mb={4} minH="1.25em">
            {loaded &&
              `${summary.total} ${summary.total === 1 ? 'agent' : 'agents'}` +
                (summary.total ? ` · ${summary.active} active` : '')}
          </Text>
          {loadError && (
            <Box
              borderWidth="1px"
              borderColor="border.error"
              bg="bg.error"
              borderRadius="md"
              p={3}
              mb={4}
            >
              <Text color="fg.error">{loadError}</Text>
            </Box>
          )}
          {!loaded && loading && (
            <Box bg="bg.panel" borderWidth="1px" borderRadius="lg" p={8} textAlign="center">
              <Text color="fg.muted">Loading your agents...</Text>
            </Box>
          )}
          {loaded && agents.length === 0 && (
            <Box bg="bg.panel" borderWidth="1px" borderRadius="lg">
              <EmptyState
                icon={<LuBot size={24} />}
                title="No agents yet"
                description="Create an agent to record its role, skills, and permissions, then assign it tasks. It won’t run anything yet."
              />
            </Box>
          )}
          {agents.length > 0 && (
            <SimpleGrid
              as="ul"
              listStyleType="none"
              m={0}
              p={0}
              columns={{ base: 1, md: 2 }}
              gap={4}
            >
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
            </SimpleGrid>
          )}
        </Box>
      </SimpleGrid>
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
    </Box>
  );
};

export default WorkforcePage;
