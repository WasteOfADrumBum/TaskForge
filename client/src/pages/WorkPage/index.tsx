import { SessionExpiredError } from '../../utils/session';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
import { LuInbox, LuListFilter, LuPlus, LuRotateCcw, LuSearch } from 'react-icons/lu';
import { useLocation } from 'react-router-dom';
import { createTask, deleteTask, updateTask } from '../../api/tasks';
import EmptyState from '../../components/common/EmptyState';
import DeleteTaskDialog from '../../components/tasks/DeleteTaskDialog';
import TaskCard from '../../components/tasks/TaskCard';
import { toaster } from '../../components/ui/toaster';
import { useAppDispatch, useAppSelector } from '../../redux/hooks/typedHooks';
import {
  addTask,
  removeTask,
  replaceTask,
  setTaskError,
  setTaskLoading,
} from '../../redux/slices/taskSlice';
import { getTaskId, type Task, type TaskPriority, type TaskStatus } from '../../types/task';
import { toCalendarDate } from '../../utils/dates';
import { filterAndSortTasks, type TaskSort } from '../../utils/tasks';

const WorkPage = () => {
  const dispatch = useAppDispatch();
  const location = useLocation();
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
  const titleRef = useRef<HTMLInputElement>(null);

  const filteredTasks = useMemo(
    () =>
      filterAndSortTasks(tasks, { search, status: statusFilter, priority: priorityFilter, sort }),
    [tasks, search, statusFilter, priorityFilter, sort],
  );

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

  // The top bar's "New Task" action navigates here with a fresh request id. A new request
  // cancels any in-progress edit (adjusting state during render) and focuses the title field.
  const newTaskRequest = (location.state as { newTask?: number } | null)?.newTask;
  const [handledRequest, setHandledRequest] = useState(newTaskRequest);
  if (newTaskRequest !== handledRequest) {
    setHandledRequest(newTaskRequest);
    resetForm();
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
    setDueDate(toCalendarDate(task.dueDate) ?? '');
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
      <Box mb={{ base: 6, md: 8 }}>
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
      <SimpleGrid columns={{ base: 1, xl: 3 }} gap={6} alignItems="start">
        <Box
          as="form"
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
        </Box>
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
              <SimpleGrid columns={{ base: 1, md: 3 }} gap={3}>
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
