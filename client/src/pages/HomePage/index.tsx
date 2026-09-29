import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Badge,
  Box,
  Button,
  Field,
  Heading,
  HStack,
  Input,
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
  };

  const handleDelete = async (task: Task) => {
    if (!token) return;
    const confirmed = window.confirm('Delete task ' + task.title + '?');
    if (!confirmed) return;
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
    <Box maxW="7xl" mx="auto" p={6}>
      <HStack justify="space-between" mb={8}>
        <Box>
          <Heading>TaskForge</Heading>
          <Text>Forge your workload into a plan.</Text>
        </Box>
        <Button onClick={handleLogout}>Log out</Button>
      </HStack>

      <SimpleGrid columns={{ base: 2, md: 5 }} gap={4} mb={8}>
        <Box borderWidth={1} borderRadius="lg" p={4}>
          <Text fontSize="sm">Total</Text>
          <Heading size="lg">{summary.total}</Heading>
        </Box>
        <Box borderWidth={1} borderRadius="lg" p={4}>
          <Text fontSize="sm">To Do</Text>
          <Heading size="lg">{summary.todo}</Heading>
        </Box>
        <Box borderWidth={1} borderRadius="lg" p={4}>
          <Text fontSize="sm">In Progress</Text>
          <Heading size="lg">{summary.inProgress}</Heading>
        </Box>
        <Box borderWidth={1} borderRadius="lg" p={4}>
          <Text fontSize="sm">Done</Text>
          <Heading size="lg">{summary.done}</Heading>
        </Box>
        <Box borderWidth={1} borderRadius="lg" p={4}>
          <Text fontSize="sm">Overdue</Text>
          <Heading size="lg">{summary.overdue}</Heading>
        </Box>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, lg: 2 }} gap={8}>
        <Box as="form" onSubmit={handleSubmit} borderWidth={1} borderRadius="lg" p={6}>
          <Heading size="lg" mb={5}>
            {editingId ? 'Edit Task' : 'Create Task'}
          </Heading>
          <VStack align="stretch" gap={4}>
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
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>Status</Field.Label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as TaskStatus)}
              >
                <option value="todo">To do</option>
                <option value="in-progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </Field.Root>
            <Field.Root>
              <Field.Label>Priority</Field.Label>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </Field.Root>
            <Field.Root>
              <Field.Label>Due date</Field.Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </Field.Root>
            {error && <Text color="red.500">{error}</Text>}
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

        <Box>
          <Heading size="lg" mb={5}>
            Your Tasks
          </Heading>
          <VStack align="stretch" gap={3} mb={5}>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks..."
            />
            <SimpleGrid columns={{ base: 1, md: 3 }} gap={3}>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as TaskStatus | 'all')}
              >
                <option value="all">All statuses</option>
                <option value="todo">To do</option>
                <option value="in-progress">In progress</option>
                <option value="done">Done</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value as TaskPriority | 'all')}
              >
                <option value="all">All priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <select value={sort} onChange={(event) => setSort(event.target.value as TaskSort)}>
                <option value="created-desc">Newest first</option>
                <option value="created-asc">Oldest first</option>
                <option value="due-asc">Due date</option>
                <option value="priority-desc">Priority</option>
              </select>
            </SimpleGrid>
            <HStack justify="space-between">
              <Text fontSize="sm">
                Showing {filteredTasks.length} of {tasks.length} tasks
              </Text>
              <Button size="sm" variant="outline" onClick={resetFilters}>
                Clear filters
              </Button>
            </HStack>
          </VStack>

          {loading && tasks.length === 0 && <Text>Loading tasks...</Text>}
          {!loading && tasks.length === 0 && <Text>No tasks yet. Create your first task.</Text>}
          {!loading && tasks.length > 0 && filteredTasks.length === 0 && (
            <Text>No tasks match your current filters.</Text>
          )}

          <VStack align="stretch" gap={4}>
            {filteredTasks.map((task) => {
              const taskId = getTaskId(task);
              const overdue = isTaskOverdue(task);
              return (
                <Box key={taskId} borderWidth={1} borderRadius="lg" p={5}>
                  <HStack justify="space-between" align="start">
                    <Box>
                      <Heading size="md">{task.title}</Heading>
                      <Text mt={2}>{task.description || 'No description'}</Text>
                    </Box>
                    <HStack>
                      <Badge>{task.status}</Badge>
                      <Badge>{task.priority}</Badge>
                      {overdue && <Badge>Overdue</Badge>}
                    </HStack>
                  </HStack>
                  {task.dueDate && (
                    <Text mt={3}>Due: {new Date(task.dueDate).toLocaleDateString()}</Text>
                  )}
                  <HStack mt={4}>
                    <Button size="sm" variant="outline" onClick={() => startEdit(task)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void handleDelete(task)}>
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
  );
};

export default HomePage;
