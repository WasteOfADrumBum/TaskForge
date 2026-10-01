import { SessionExpiredError } from '../../utils/session';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Box,
  Button,
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
import { LuListFilter, LuLogOut, LuPlus, LuRotateCcw, LuSearch, LuSettings } from 'react-icons/lu';
import { Link, useNavigate } from 'react-router-dom';
import { logout } from '../../api/auth';
import { createTask, deleteTask, getTasks, updateTask } from '../../api/tasks';
import AppFooter from '../../components/layout/AppFooter';
import Brand from '../../components/layout/Brand';
import DeleteTaskDialog from '../../components/tasks/DeleteTaskDialog';
import TaskCard from '../../components/tasks/TaskCard';
import { toaster } from '../../components/ui/toaster';
import { useAppDispatch, useAppSelector } from '../../redux/hooks/typedHooks';
import { clearAuth } from '../../redux/slices/authSlice';
import {
  addTask,
  clearTasks,
  removeTask,
  replaceTask,
  setTaskError,
  setTaskLoading,
  setTasks,
} from '../../redux/slices/taskSlice';
import { getTaskId, type Task, type TaskPriority, type TaskStatus } from '../../types/task';
import { filterAndSortTasks, getTaskSummary, type TaskSort } from '../../utils/tasks';

const HomePage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const token = useAppSelector((state) => state.auth.token);
  const tasks = useAppSelector((state) => state.tasks.items);
  const loading = useAppSelector((state) => state.tasks.loading);
  const error = useAppSelector((state) => state.tasks.error);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [sort, setSort] = useState<TaskSort>('created-desc');

  const filteredTasks = useMemo(
    () =>
      filterAndSortTasks(tasks, { search, status: statusFilter, priority: priorityFilter, sort }),
    [tasks, search, statusFilter, priorityFilter, sort],
  );
  const summary = useMemo(() => getTaskSummary(tasks), [tasks]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadTasks = async () => {
      dispatch(setTaskLoading(true));
      dispatch(setTaskError(null));
      try {
        const loadedTasks = await getTasks(token);
        if (active) dispatch(setTasks(loadedTasks));
      } catch (loadError) {
        if (loadError instanceof SessionExpiredError) return;
        const message = loadError instanceof Error ? loadError.message : 'Unable to load tasks';
        if (active) dispatch(setTaskError(message));
      } finally {
        if (active) dispatch(setTaskLoading(false));
      }
    };
    void loadTasks();
    return () => {
      active = false;
    };
  }, [dispatch, token]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate('');
    setEditingId(null);
  };
  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setSort('created-desc');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    dispatch(setTaskLoading(true));
    dispatch(setTaskError(null));
    const input = { title, description, priority, dueDate: dueDate || null };
    try {
      if (editingId) {
        const task = await updateTask(token, editingId, input);
        dispatch(replaceTask(task));
        toaster.create({
          title: 'Task Updated',
          description: 'Your changes were saved.',
          type: 'success',
        });
      } else {
        const task = await createTask(token, { ...input, status: 'todo' });
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
    setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : '');
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

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      localStorage.removeItem('token');
      dispatch(clearTasks());
      dispatch(clearAuth());
      navigate('/login');
    }
  };

  const metrics = [
    { label: 'Total Tasks', value: summary.total, accent: 'purple.400' },
    { label: 'To Do', value: summary.todo, accent: 'blue.400' },
    { label: 'In Progress', value: summary.inProgress, accent: 'orange.400' },
    { label: 'Completed', value: summary.done, accent: 'green.400' },
    { label: 'Overdue', value: summary.overdue, accent: 'red.400' },
  ];

  return (
    <Box minH="100vh" bg="bg.subtle" display="flex" flexDirection="column">
      <Box bg="bg.panel" borderBottomWidth="1px">
        <HStack maxW="7xl" mx="auto" px={{ base: 4, md: 6 }} py={4} justify="space-between">
          <Brand />
          <HStack>
            <Button asChild variant="ghost">
              <Link to="/settings">
                <LuSettings />
                Settings
              </Link>
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LuLogOut />
              Log out
            </Button>
          </HStack>
        </HStack>
      </Box>
      <Box maxW="7xl" w="full" mx="auto" px={{ base: 4, md: 6 }} py={8} flex="1">
        <SimpleGrid columns={{ base: 2, md: 5 }} gap={4} mb={8}>
          {metrics.map((metric) => (
            <Box
              key={metric.label}
              bg="bg.panel"
              borderWidth="1px"
              borderTopWidth="3px"
              borderTopColor={metric.accent}
              borderRadius="xl"
              p={5}
            >
              <Text color="fg.muted" fontSize="sm">
                {metric.label}
              </Text>
              <Heading mt={1}>{metric.value}</Heading>
            </Box>
          ))}
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, xl: 3 }} gap={8} alignItems="start">
          <Box
            as="form"
            onSubmit={handleSubmit}
            bg="bg.panel"
            borderWidth="1px"
            borderRadius="xl"
            p={6}
          >
            <Heading size="lg" mb={1}>
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
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="What needs to get done?"
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>Description</Field.Label>
                <Textarea
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
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </Field.Root>
              {error && (
                <Box
                  borderWidth="1px"
                  borderColor="red.300"
                  bg="red.subtle"
                  borderRadius="md"
                  p={3}
                >
                  <Text color="red.fg">{error}</Text>
                </Box>
              )}
              <HStack>
                <Button type="submit" loading={loading}>
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
          </Box>
          <Box gridColumn={{ xl: 'span 2' }}>
            <Box bg="bg.panel" borderWidth="1px" borderRadius="xl" p={6} mb={5}>
              <HStack justify="space-between" mb={4}>
                <Box>
                  <Heading size="lg">Your Tasks</Heading>
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
                  >
                    <LuSearch />
                  </Box>
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search titles and descriptions..."
                    pl="10"
                  />
                </Box>
                <SimpleGrid columns={{ base: 1, md: 3 }} gap={3}>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(event.target.value as TaskStatus | 'all')
                      }
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
              <Box bg="bg.panel" borderWidth="1px" borderRadius="xl" p={8} textAlign="center">
                <Text color="fg.muted">Loading your tasks...</Text>
              </Box>
            )}
            {!loading && tasks.length === 0 && (
              <Box bg="bg.panel" borderWidth="1px" borderRadius="xl" p={8} textAlign="center">
                <Heading size="md">No tasks yet</Heading>
                <Text color="fg.muted" mt={2}>
                  Create your first task to start building your workspace.
                </Text>
              </Box>
            )}
            {!loading && tasks.length > 0 && filteredTasks.length === 0 && (
              <Box bg="bg.panel" borderWidth="1px" borderRadius="xl" p={8} textAlign="center">
                <LuListFilter />
                <Heading size="md" mt={2}>
                  Nothing matches
                </Heading>
                <Text color="fg.muted" mt={2}>
                  Try changing your search or filters.
                </Text>
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
                />
              ))}
            </VStack>
          </Box>
        </SimpleGrid>
      </Box>
      <AppFooter />
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

export default HomePage;
