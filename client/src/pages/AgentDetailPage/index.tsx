import { isCurrentSession } from '../../api/authenticatedFetch';
import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  Link,
  SimpleGrid,
  Text,
  VStack,
} from '@chakra-ui/react';
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
  <Link asChild fontSize="sm" color="fg.muted" _hover={{ color: 'accent.teal' }}>
    <RouterLink to="/workforce">
      <LuArrowLeft aria-hidden="true" />
      All agents
    </RouterLink>
  </Link>
);

const panelProps = {
  as: 'section',
  bg: 'bg.panel',
  borderWidth: '1px',
  borderRadius: 'lg',
  p: { base: 4, md: 5 },
  minW: '0',
} as const;

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
    <Box>
      <Box mb={{ base: 5, md: 6 }}>
        <BackLink />
        <Heading as="h1" size={{ base: '2xl', md: '3xl' }} mt={3}>
          {heading}
        </Heading>
      </Box>
      {body}
    </Box>
  );

  if (!loaded) {
    return statePage(
      'Agent',
      loadError ? (
        <Box borderWidth="1px" borderColor="border.error" bg="bg.error" borderRadius="md" p={3}>
          <Text color="fg.error">{loadError}</Text>
        </Box>
      ) : (
        <Text color="fg.muted">Loading agent...</Text>
      ),
    );
  }

  if (!agent) {
    return statePage(
      'Agent not found',
      <Box bg="bg.panel" borderWidth="1px" borderRadius="lg">
        <EmptyState
          icon={<LuBotOff size={24} />}
          title="This agent doesn't exist"
          description="It may have been deleted, or the link is wrong."
        />
      </Box>,
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
    <Box>
      <Box mb={{ base: 5, md: 6 }}>
        <BackLink />
        <HStack mt={3} gap={3} flexWrap="wrap" align="center">
          <Heading as="h1" size={{ base: '2xl', md: '3xl' }} minW="0" wordBreak="break-word">
            {agent.name}
          </Heading>
          <AgentStatusBadge status={agent.status} />
        </HStack>
        <Text color="accent.violet" mt={1}>
          {agent.role}
        </Text>
        {agent.description && (
          <Text color="fg.muted" mt={2} whiteSpace="pre-wrap">
            {agent.description}
          </Text>
        )}
        <HStack mt={4} gap={2} flexWrap="wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              clearError();
              setEditing(true);
            }}
            disabled={editing}
          >
            <LuPencil />
            Edit agent
          </Button>
          {agent.status === 'active' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/work', { state: { newTask: Date.now(), agentId: id } })}
            >
              <LuPlus />
              Assign a new task
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            colorPalette="red"
            onClick={() => setDeleteTarget(agent)}
          >
            <LuTrash2 />
            Delete
          </Button>
        </HStack>
      </Box>

      {editing && (
        <Box mb={6} maxW="2xl">
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
        </Box>
      )}

      <SimpleGrid columns={{ base: 1, xl: 3 }} gap={6} alignItems="start">
        <VStack align="stretch" gap={6} gridColumn={{ xl: 'span 2' }} minW="0">
          <Box {...panelProps} aria-labelledby="agent-assignments-heading">
            <SectionHeader
              id="agent-assignments-heading"
              title="Assigned tasks"
              count={tasksReady ? assignedTasks.length : undefined}
              action={{ label: 'Open Work', to: '/work' }}
            />
            {agent.status !== 'active' && (
              <Text fontSize="sm" color="fg.muted" mb={3}>
                This agent is {agent.status}. It keeps existing assignments but can’t take new ones.
              </Text>
            )}
            {!tasksReady ? (
              <Box>
                <Text color={tasksError ? 'fg.error' : 'fg.muted'}>
                  {tasksError ? 'Assigned tasks unavailable.' : 'Loading assigned tasks...'}
                </Text>
                {tasksError && (
                  <Text color="fg.error" fontSize="sm" mt={1}>
                    {tasksError}
                  </Text>
                )}
              </Box>
            ) : assignedTasks.length ? (
              <Box as="ul" listStyleType="none" m={0} p={0} aria-label="Assigned tasks">
                {assignedTasks.map((task) => (
                  <PriorityTaskRow
                    key={getTaskId(task)}
                    task={task}
                    project={task.project ? projectsById.get(task.project) : undefined}
                  />
                ))}
              </Box>
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
          </Box>

          <Box {...panelProps} aria-labelledby="agent-skills-heading">
            <SectionHeader id="agent-skills-heading" title="Skills" count={agent.skills.length} />
            <SkillTags skills={agent.skills} />
          </Box>

          <Box {...panelProps} aria-labelledby="agent-permissions-heading">
            <SectionHeader
              id="agent-permissions-heading"
              title="Permissions"
              count={agent.permissions.length}
            />
            <Text fontSize="sm" color="fg.muted" mb={3}>
              Drafts require Read tasks and Draft artifacts. Update permissions do not enable
              automatic changes.
            </Text>
            <Box as="ul" listStyleType="none" m={0} p={0}>
              {AGENT_PERMISSIONS.map((item) => {
                const granted = agent.permissions.includes(item.id);
                return (
                  <HStack
                    as="li"
                    key={item.id}
                    justify="space-between"
                    gap={3}
                    py={2.5}
                    borderTopWidth="1px"
                    borderColor="border.muted"
                    opacity={granted ? 1 : 0.6}
                  >
                    <Box minW="0">
                      <Text fontSize="sm" fontWeight="medium">
                        {item.label}
                      </Text>
                      <Text fontSize="xs" color="fg.muted">
                        {item.id} · {item.description}
                      </Text>
                    </Box>
                    <Badge
                      size="sm"
                      variant={granted ? 'subtle' : 'outline'}
                      colorPalette={granted ? 'teal' : 'gray'}
                      flexShrink={0}
                    >
                      {granted ? 'Allowed' : 'Not allowed'}
                    </Badge>
                  </HStack>
                );
              })}
            </Box>
          </Box>

          <ApprovalPanel key={id + ':' + sessionVersion} agentId={id} />

          <Box {...panelProps} aria-labelledby="agent-runs-heading">
            <SectionHeader id="agent-runs-heading" title="Run activity" />
            <Text fontSize="sm" color="fg.muted" mb={3}>
              View recorded attempts, results, context and review decisions. Assignment alone starts
              no work.
            </Text>
            <Link asChild color="accent.teal">
              <RouterLink to="/workforce/runs">View run activity</RouterLink>
            </Link>
          </Box>
        </VStack>

        <Box {...panelProps} aria-labelledby="agent-details-heading">
          <SectionHeader id="agent-details-heading" title="Details" />
          <SimpleGrid as="dl" columns={1} gap={4}>
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
              <Box key={String(label)}>
                <Text as="dt" fontSize="xs" color="fg.muted">
                  {label}
                </Text>
                <Box as="dd" fontWeight="semibold" m={0} wordBreak="break-word">
                  {value}
                </Box>
              </Box>
            ))}
          </SimpleGrid>
        </Box>
      </SimpleGrid>

      <DeleteAgentDialog
        agent={deleteTarget}
        assignedCount={tasksReady ? assignedTasks.length : null}
        loading={saving}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </Box>
  );
};

export default AgentDetailPage;
