import { SessionExpiredError } from '../../utils/session';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Box,
  Button,
  chakra,
  Field,
  Heading,
  HStack,
  Input,
  NativeSelect,
  SimpleGrid,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { LuInbox, LuListFilter, LuPlus, LuRotateCcw, LuSearch } from 'react-icons/lu';
import { useLocation } from 'react-router-dom';
import { createTask, deleteTask, updateTask } from '../../api/tasks';
import EmptyState from '../../components/common/EmptyState';
import DeleteTaskDialog from '../../components/tasks/DeleteTaskDialog';
import TaskCard from '../../components/tasks/TaskCard';
import { toaster } from '../../components/ui/toaster';
import { useToday } from '../../hooks/useToday';
import { useAppDispatch, useAppSelector } from '../../redux/hooks/typedHooks';
import {
  addTask,
  removeTask,
  replaceTask,
  setTaskError,
  setTaskLoading,
} from '../../redux/slices/taskSlice';
import WorkTabs from '../../components/work/WorkTabs';
import { agentStatusLabel, getAgentId } from '../../types/agent';
import { getProjectId, projectStatusLabel } from '../../types/project';
import {
  getTaskId,
  TASK_TITLE_MAX,
  TASK_DESCRIPTION_MAX,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '../../types/task';
import {
  agentFromValue,
  assigneeInput,
  assigneeValue,
  getTaskAssignee,
  type AssigneeFilter,
} from '../../utils/assignees';
import { toCalendarDate } from '../../utils/dates';
import { sortProjects } from '../../utils/projects';
import { filterAndSortTasks, type TaskSort } from '../../utils/tasks';

const WorkPage = () => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const token = useAppSelector((state) => state.auth.token);
  const tasks = useAppSelector((state) => state.tasks.items);
  const loading = useAppSelector((state) => state.tasks.loading);
  const error = useAppSelector((state) => state.tasks.error);
  const projects = useAppSelector((state) => state.projects.items);
  const projectsLoaded = useAppSelector((state) => state.projects.loaded);
  const projectsError = useAppSelector((state) => state.projects.error);
  const agents = useAppSelector((state) => state.agents.items);
  const agentsLoaded = useAppSelector((state) => state.agents.loaded);
  const agentsError = useAppSelector((state) => state.agents.error);
  // Location state from the top bar's New Task (newTask), a project's "New task in project"
  // (newTask + projectId), or an agent's "Assign a new task" (newTask + agentId).
  const navState = location.state as {
    newTask?: number;
    projectId?: string;
    agentId?: string;
  } | null;
  const navAssignee = navState?.agentId ? 'agent:' + navState.agentId : '';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  // '' means Unassigned.
  const [projectId, setProjectId] = useState(navState?.projectId ?? '');
  const [editingId, setEditingId] = useState<string | null>(null);
  // The edited task's project when editing started. An update only sends `project` when the
  // user changed it, so a title-only edit can never unassign a task (for example while
  // projects are still loading or failed to load).
  const [editingOriginalProject, setEditingOriginalProject] = useState<string | null>(null);
  // The assignee select value: '' (Unassigned), 'me', or 'agent:<id>'. Like the project, an
  // update only sends the assignee when the user changed it, so editing another field never
  // changes or clears it, even while agents are loading, failed to load, or the agent is gone.
  const [assignee, setAssignee] = useState(navAssignee);
  const [editingOriginalAssignee, setEditingOriginalAssignee] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all');
  const [sort, setSort] = useState<TaskSort>('created-desc');
  const titleRef = useRef<HTMLInputElement>(null);
  // Overdue badges roll over at local midnight, like the Command Center.
  const today = useToday();

  const filteredTasks = useMemo(
    () =>
      filterAndSortTasks(tasks, {
        search,
        status: statusFilter,
        priority: priorityFilter,
        assignee: assigneeFilter,
        sort,
      }),
    [tasks, search, statusFilter, priorityFilter, assigneeFilter, sort],
  );
  const sortedProjects = useMemo(() => sortProjects(projects), [projects]);
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [getProjectId(project), project])),
    [projects],
  );
  const agentsById = useMemo(
    () => new Map(agents.map((agent) => [getAgentId(agent), agent])),
    [agents],
  );
  // Only active agents can take a new task.
  const activeAgents = useMemo(
    () =>
      agents
        .filter((agent) => agent.status === 'active')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [agents],
  );
  const selectedAgentId = agentFromValue(assignee);
  const selectedAgent = selectedAgentId ? agentsById.get(selectedAgentId) : undefined;
  // Agents that can't be offered as a new choice (paused, disabled, or not loaded) but must stay
  // in the list: the edited task's current agent, so the user can switch back to it, and the
  // selection itself (for example a requested agent while agents are still loading).
  const inactiveOptions = [
    ...new Set(
      [agentFromValue(editingOriginalAssignee), selectedAgentId].filter(
        (agentId): agentId is string =>
          agentId !== null && agentsById.get(agentId)?.status !== 'active',
      ),
    ),
  ];
  const inactiveLabel = (agentId: string) => {
    const agent = agentsById.get(agentId);
    if (agent) return agent.name + ' (' + agentStatusLabel[agent.status] + ')';
    if (agentsLoaded) return 'Deleted agent';
    return agentsError ? 'Agents unavailable' : 'Loading agents...';
  };

  const agentForTask = (task: Task) => {
    const taskAssignee = getTaskAssignee(task);
    return taskAssignee.kind === 'agent' ? agentsById.get(taskAssignee.agentId) : undefined;
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate('');
    setProjectId('');
    setAssignee('');
    setEditingId(null);
    setEditingOriginalProject(null);
    setEditingOriginalAssignee('');
  };
  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setAssigneeFilter('all');
    setSort('created-desc');
  };

  // The top bar's "New Task" action navigates here with a fresh request id. A new request
  // cancels any in-progress edit (adjusting state during render) and focuses the title field.
  const newTaskRequest = navState?.newTask;
  const [handledRequest, setHandledRequest] = useState(newTaskRequest);
  if (newTaskRequest !== handledRequest) {
    setHandledRequest(newTaskRequest);
    resetForm();
    setProjectId(navState?.projectId ?? '');
    setAssignee(navAssignee);
  }
  useEffect(() => {
    if (newTaskRequest) titleRef.current?.focus();
  }, [newTaskRequest]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    dispatch(setTaskLoading(true));
    dispatch(setTaskError(null));
    const input = { title, description, priority, dueDate: dueDate || null };
    const project = projectId || null;
    try {
      if (editingId) {
        const task = await updateTask(token, editingId, {
          ...input,
          ...(project !== editingOriginalProject && { project }),
          ...(assignee !== editingOriginalAssignee && assigneeInput(assignee)),
        });
        dispatch(replaceTask(task));
        toaster.create({
          title: 'Task Updated',
          description: 'Your changes were saved.',
          type: 'success',
        });
      } else {
        const task = await createTask(token, {
          ...input,
          project,
          ...(assignee && assigneeInput(assignee)),
          status: 'todo',
        });
        dispatch(addTask(task));
        toaster.create({
          title: 'Task Created',
          description: 'Added to your To Do queue.',
          type: 'success',
        });
      }
      resetForm();
    } catch (submitError) {
      if (submitError instanceof SessionExpiredError) return;
      const message = submitError instanceof Error ? submitError.message : 'Unable to save task';
      dispatch(setTaskError(message));
      toaster.create({ title: 'Task Error', description: message, type: 'error' });
    } finally {
      dispatch(setTaskLoading(false));
    }
  };

  const startEdit = (task: Task) => {
    setEditingId(getTaskId(task));
    setTitle(task.title);
    setDescription(task.description ?? '');
    setPriority(task.priority);
    setDueDate(toCalendarDate(task.dueDate) ?? '');
    // Keep the real reference even if that project isn't in the list (not loaded yet, failed
    // to load, or deleted); the select shows a labelled placeholder for it.
    setProjectId(task.project ?? '');
    setEditingOriginalProject(task.project ?? null);
    // Same for the assignee: keep the stored agent even if it isn't loaded or isn't active.
    setAssignee(assigneeValue(task));
    setEditingOriginalAssignee(assigneeValue(task));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStatusChange = async (task: Task, status: TaskStatus) => {
    if (!token) return;
    try {
      const updated = await updateTask(token, getTaskId(task), { status });
      dispatch(replaceTask(updated));
      toaster.create({
        title:
          status === 'done'
            ? 'Task Completed'
            : status === 'in-progress'
              ? 'Task Started'
              : 'Task Reopened',
        description: task.title,
        type: 'success',
      });
    } catch (updateError) {
      if (updateError instanceof SessionExpiredError) return;
      const message = updateError instanceof Error ? updateError.message : 'Unable to update task';
      dispatch(setTaskError(message));
      toaster.create({ title: 'Update Failed', description: message, type: 'error' });
    }
  };

  const confirmDelete = async () => {
    if (!token || !deleteTarget) return;
    const taskId = getTaskId(deleteTarget);
    dispatch(setTaskLoading(true));
    try {
      await deleteTask(token, taskId);
      dispatch(removeTask(taskId));
      if (editingId === taskId) resetForm();
      toaster.create({ title: 'Task Deleted', description: deleteTarget.title, type: 'success' });
      setDeleteTarget(null);
    } catch (deleteError) {
      if (deleteError instanceof SessionExpiredError) return;
      const message = deleteError instanceof Error ? deleteError.message : 'Unable to delete task';
      dispatch(setTaskError(message));
      toaster.create({ title: 'Delete Failed', description: message, type: 'error' });
    } finally {
      dispatch(setTaskLoading(false));
    }
  };

  return (
    <Box>
      <Box mb={{ base: 5, md: 6 }}>
        <Text
          color="accent.teal"
          fontSize="xs"
          fontWeight="semibold"
          letterSpacing="widest"
          textTransform="uppercase"
        >
          Tasks
        </Text>
        <Heading as="h1" size={{ base: '2xl', md: '3xl' }} mt={1.5}>
          Work
        </Heading>
        <Text color="fg.muted" mt={1.5}>
          Create, prioritize, and move your tasks from to do to done.
        </Text>
      </Box>
      <WorkTabs />
      <SimpleGrid columns={{ base: 1, xl: 3 }} gap={6} alignItems="start">
        <chakra.form
          aria-labelledby="task-form-heading"
          onSubmit={handleSubmit}
          bg="bg.panel"
          borderWidth="1px"
          borderRadius="lg"
          p={{ base: 4, md: 6 }}
          minW="0"
        >
          <Heading as="h2" id="task-form-heading" size="lg" mb={1}>
            {editingId ? 'Edit Task' : 'Create Task'}
          </Heading>
          <Text color="fg.muted" mb={6}>
            {editingId
              ? 'Update task details without changing its workflow status.'
              : 'New tasks start in To Do automatically.'}
          </Text>
          <VStack align="stretch" gap={5}>
            <Field.Root required>
              <Field.Label>Title</Field.Label>
              <Input
                ref={titleRef}
                maxLength={TASK_TITLE_MAX}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What needs to get done?"
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>Description</Field.Label>
              <Textarea
                maxLength={TASK_DESCRIPTION_MAX}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Add useful context"
                rows={4}
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>Priority</Field.Label>
              <NativeSelect.Root>
                <NativeSelect.Field
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as TaskPriority)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            <Field.Root>
              <Field.Label>Due date</Field.Label>
              <Input
                type="date"
                min="0001-01-01"
                max="9999-12-31"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>Project</Field.Label>
              <NativeSelect.Root>
                <NativeSelect.Field
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {projectId && !projectsById.has(projectId) && (
                    <option value={projectId}>
                      {projectsLoaded
                        ? 'Deleted project'
                        : projectsError
                          ? 'Projects unavailable'
                          : 'Loading projects...'}
                    </option>
                  )}
                  {sortedProjects.map((project) => (
                    <option key={getProjectId(project)} value={getProjectId(project)}>
                      {project.name}
                      {project.status === 'active'
                        ? ''
                        : ' (' + projectStatusLabel[project.status] + ')'}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            <Field.Root>
              <Field.Label>Assignee</Field.Label>
              <NativeSelect.Root>
                <NativeSelect.Field
                  value={assignee}
                  onChange={(event) => setAssignee(event.target.value)}
                >
                  <option value="">Unassigned</option>
                  <option value="me">Me</option>
                  {inactiveOptions.map((agentId) => (
                    <option key={agentId} value={'agent:' + agentId}>
                      {inactiveLabel(agentId)}
                    </option>
                  ))}
                  {activeAgents.length > 0 && (
                    <optgroup label="Agents">
                      {activeAgents.map((agent) => (
                        <option key={getAgentId(agent)} value={'agent:' + getAgentId(agent)}>
                          {agent.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
              {selectedAgent && selectedAgent.status !== 'active' ? (
                <Field.HelperText>
                  {selectedAgent.name} is {agentStatusLabel[selectedAgent.status].toLowerCase()}. It
                  keeps this task but can’t take new ones.
                </Field.HelperText>
              ) : (
                <Field.HelperText>
                  Only active agents can take new tasks. Agents don’t run yet.
                </Field.HelperText>
              )}
            </Field.Root>
            {error && (
              <Box
                borderWidth="1px"
                borderColor="border.error"
                bg="bg.error"
                borderRadius="md"
                p={3}
              >
                <Text color="fg.error">{error}</Text>
              </Box>
            )}
            <HStack>
              <Button type="submit" colorPalette="teal" loading={loading}>
                <LuPlus />
                {editingId ? 'Save Changes' : 'Create Task'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </HStack>
          </VStack>
        </chakra.form>
        <Box
          as="section"
          aria-labelledby="task-list-heading"
          gridColumn={{ xl: 'span 2' }}
          minW="0"
        >
          <Box bg="bg.panel" borderWidth="1px" borderRadius="lg" p={{ base: 4, md: 6 }} mb={5}>
            <HStack justify="space-between" mb={4}>
              <Box>
                <Heading as="h2" id="task-list-heading" size="lg">
                  Your Tasks
                </Heading>
                <Text color="fg.muted" fontSize="sm" mt={1}>
                  {filteredTasks.length} of {tasks.length} shown
                </Text>
              </Box>
              <Button size="sm" variant="ghost" onClick={resetFilters}>
                <LuRotateCcw />
                Reset
              </Button>
            </HStack>
            <VStack align="stretch" gap={4}>
              <Box position="relative">
                <Box
                  position="absolute"
                  left="3"
                  top="50%"
                  transform="translateY(-50%)"
                  color="fg.muted"
                  zIndex="1"
                  aria-hidden="true"
                >
                  <LuSearch />
                </Box>
                <Input
                  aria-label="Search tasks"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search titles and descriptions..."
                  pl="10"
                />
              </Box>
              <SimpleGrid columns={{ base: 1, md: 2, '2xl': 4 }} gap={3}>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    aria-label="Filter by status"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as TaskStatus | 'all')}
                  >
                    <option value="all">All statuses</option>
                    <option value="todo">To Do</option>
                    <option value="in-progress">In Progress</option>
                    <option value="done">Done</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    aria-label="Filter by priority"
                    value={priorityFilter}
                    onChange={(event) =>
                      setPriorityFilter(event.target.value as TaskPriority | 'all')
                    }
                  >
                    <option value="all">All priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    aria-label="Filter by assignee"
                    value={assigneeFilter}
                    onChange={(event) => setAssigneeFilter(event.target.value as AssigneeFilter)}
                  >
                    <option value="all">All assignees</option>
                    <option value="me">Me</option>
                    <option value="agents">Agents</option>
                    <option value="unassigned">Unassigned</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    aria-label="Sort tasks"
                    value={sort}
                    onChange={(event) => setSort(event.target.value as TaskSort)}
                  >
                    <option value="created-desc">Newest first</option>
                    <option value="created-asc">Oldest first</option>
                    <option value="due-asc">Due date</option>
                    <option value="priority-desc">Highest priority</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </SimpleGrid>
            </VStack>
          </Box>
          {loading && tasks.length === 0 && (
            <Box bg="bg.panel" borderWidth="1px" borderRadius="lg" p={8} textAlign="center">
              <Text color="fg.muted">Loading your tasks...</Text>
            </Box>
          )}
          {!loading && tasks.length === 0 && (
            <Box bg="bg.panel" borderWidth="1px" borderRadius="lg">
              <EmptyState
                icon={<LuInbox size={24} />}
                title="No tasks yet"
                description="Create your first task to start building your workspace."
              />
            </Box>
          )}
          {!loading && tasks.length > 0 && filteredTasks.length === 0 && (
            <Box bg="bg.panel" borderWidth="1px" borderRadius="lg">
              <EmptyState
                icon={<LuListFilter size={24} />}
                title="Nothing matches"
                description="Try changing your search or filters."
              />
            </Box>
          )}
          <VStack align="stretch" gap={4}>
            {filteredTasks.map((task) => (
              <TaskCard
                key={getTaskId(task)}
                task={task}
                onEdit={startEdit}
                onDelete={setDeleteTarget}
                onStatusChange={(item, status) => void handleStatusChange(item, status)}
                now={today}
                project={task.project ? projectsById.get(task.project) : undefined}
                agent={agentForTask(task)}
              />
            ))}
          </VStack>
        </Box>
      </SimpleGrid>
      <DeleteTaskDialog
        task={deleteTarget}
        open={Boolean(deleteTarget)}
        loading={loading}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </Box>
  );
};

export default WorkPage;
