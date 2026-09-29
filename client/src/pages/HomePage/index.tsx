import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Badge,
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
import { useNavigate } from 'react-router-dom';
import { logout } from '../../api/auth';
import { createTask, deleteTask, getTasks, updateTask } from '../../api/tasks';
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
import {
  filterAndSortTasks,
  getTaskSummary,
  isTaskOverdue,
  type TaskSort,
} from '../../utils/tasks';

const statusLabel: Record<TaskStatus, string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  done: 'Done',
};
const priorityLabel: Record<TaskPriority, string> = { low: 'Low', medium: 'Medium', high: 'High' };
const statusPalette: Record<TaskStatus, string> = {
  todo: 'gray',
  'in-progress': 'blue',
  done: 'green',
};
const priorityPalette: Record<TaskPriority, string> = {
  low: 'gray',
  medium: 'orange',
  high: 'red',
};

const HomePage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const token = useAppSelector((state) => state.auth.token);
  const tasks = useAppSelector((state) => state.tasks.items);
  const loading = useAppSelector((state) => state.tasks.loading);
  const error = useAppSelector((state) => state.tasks.error);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
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
    setStatus('todo');
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
    const input = { title, description, status, priority, dueDate: dueDate || null };
    try {
      if (editingId) {
        const task = await updateTask(token, editingId, input);
        dispatch(replaceTask(task));
        toaster.create({
          title: 'Task Updated',
          description: 'Your task was updated successfully.',
          type: 'success',
        });
      } else {
        const task = await createTask(token, input);
        dispatch(addTask(task));
        toaster.create({
          title: 'Task Created',
          description: 'Your task was created successfully.',
          type: 'success',
        });
      }
      resetForm();
    } catch (submitError) {
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
    setStatus(task.status);
    setPriority(task.priority);
    setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickStatus = async (task: Task) => {
    if (!token) return;
    const taskId = getTaskId(task);
    const nextStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      const updated = await updateTask(token, taskId, { status: nextStatus });
      dispatch(replaceTask(updated));
      toaster.create({
        title: nextStatus === 'done' ? 'Task Completed' : 'Task Reopened',
        description: task.title,
        type: 'success',
      });
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Unable to update task';
      dispatch(setTaskError(message));
    }
  };

  const handleDelete = async (task: Task) => {
    if (!token) return;
    if (!window.confirm('Delete task ' + task.title + '?')) return;
    const taskId = getTaskId(task);
    try {
      await deleteTask(token, taskId);
      dispatch(removeTask(taskId));
      if (editingId === taskId) resetForm();
      toaster.create({
        title: 'Task Deleted',
        description: 'The task was removed.',
        type: 'success',
      });
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : 'Unable to delete task';
      dispatch(setTaskError(message));
      toaster.create({ title: 'Delete Failed', description: message, type: 'error' });
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

  return (
    <Box minH="100vh" bg="bg.subtle">
      <Box bg="bg.panel" borderBottomWidth="1px">
        <Box maxW="7xl" mx="auto" px={{ base: 4, md: 6 }} py={5}>
          <HStack justify="space-between" align="center">
            <Box>
              <Heading size="2xl">TaskForge</Heading>
              <Text color="fg.muted" mt={1}>
                Forge your workload into a plan.
              </Text>
            </Box>
            <Button variant="outline" onClick={handleLogout}>
              Log out
            </Button>
          </HStack>
        </Box>
      </Box>

      <Box maxW="7xl" mx="auto" px={{ base: 4, md: 6 }} py={8}>
        <SimpleGrid columns={{ base: 2, md: 5 }} gap={4} mb={8}>
          <Box bg="bg.panel" borderWidth="1px" borderRadius="xl" p={5}>
            <Text color="fg.muted" fontSize="sm">
              Total Tasks
            </Text>
            <Heading mt={1}>{summary.total}</Heading>
          </Box>
          <Box bg="bg.panel" borderWidth="1px" borderRadius="xl" p={5}>
            <Text color="fg.muted" fontSize="sm">
              To Do
            </Text>
            <Heading mt={1}>{summary.todo}</Heading>
          </Box>
          <Box bg="bg.panel" borderWidth="1px" borderRadius="xl" p={5}>
            <Text color="fg.muted" fontSize="sm">
              In Progress
            </Text>
            <Heading mt={1}>{summary.inProgress}</Heading>
          </Box>
          <Box bg="bg.panel" borderWidth="1px" borderRadius="xl" p={5}>
            <Text color="fg.muted" fontSize="sm">
              Completed
            </Text>
            <Heading mt={1}>{summary.done}</Heading>
          </Box>
          <Box bg="bg.panel" borderWidth="1px" borderRadius="xl" p={5}>
            <Text color="red.500" fontSize="sm">
              Overdue
            </Text>
            <Heading color={summary.overdue > 0 ? 'red.500' : undefined} mt={1}>
              {summary.overdue}
            </Heading>
          </Box>
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
              {editingId ? 'Update the details below.' : 'Add something new to your workload.'}
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
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                <Field.Root>
                  <Field.Label>Status</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={status}
                      onChange={(event) => setStatus(event.target.value as TaskStatus)}
                    >
                      <option value="todo">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="done">Done</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
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
              </SimpleGrid>
              <Field.Root>
                <Field.Label>Due date</Field.Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </Field.Root>
              {error && (
                <Box borderWidth="1px" borderColor="red.300" bg="red.50" borderRadius="md" p={3}>
                  <Text color="red.700">{error}</Text>
                </Box>
              )}
              <HStack>
                <Button type="submit" loading={loading}>
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
                  Reset filters
                </Button>
              </HStack>
              <VStack align="stretch" gap={4}>
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search titles and descriptions..."
                />
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
                <Heading size="md">Nothing matches</Heading>
                <Text color="fg.muted" mt={2}>
                  Try changing your search or filters.
                </Text>
              </Box>
            )}

            <VStack align="stretch" gap={4}>
              {filteredTasks.map((task) => {
                const taskId = getTaskId(task);
                const overdue = isTaskOverdue(task);
                return (
                  <Box
                    key={taskId}
                    bg="bg.panel"
                    borderWidth="1px"
                    borderColor={overdue ? 'red.300' : undefined}
                    borderRadius="xl"
                    p={5}
                  >
                    <HStack justify="space-between" align="start" gap={4}>
                      <Box flex="1">
                        <HStack gap={2} mb={2}>
                          <Badge colorPalette={statusPalette[task.status]}>
                            {statusLabel[task.status]}
                          </Badge>
                          <Badge colorPalette={priorityPalette[task.priority]}>
                            {priorityLabel[task.priority]}
                          </Badge>
                          {overdue && <Badge colorPalette="red">Overdue</Badge>}
                        </HStack>
                        <Heading
                          size="md"
                          textDecoration={task.status === 'done' ? 'line-through' : undefined}
                        >
                          {task.title}
                        </Heading>
                        <Text color="fg.muted" mt={2}>
                          {task.description || 'No description provided.'}
                        </Text>
                        {task.dueDate && (
                          <Text mt={3} fontSize="sm" color={overdue ? 'red.500' : 'fg.muted'}>
                            Due {new Date(task.dueDate).toLocaleDateString()}
                          </Text>
                        )}
                      </Box>
                    </HStack>
                    <HStack mt={5} flexWrap="wrap">
                      <Button size="sm" onClick={() => void handleQuickStatus(task)}>
                        {task.status === 'done' ? 'Reopen' : 'Mark Done'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startEdit(task)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void handleDelete(task)}>
                        Delete
                      </Button>
                    </HStack>
                  </Box>
                );
              })}
            </VStack>
          </Box>
        </SimpleGrid>
      </Box>
    </Box>
  );
};

export default HomePage;
