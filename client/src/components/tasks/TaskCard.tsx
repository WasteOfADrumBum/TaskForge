import { Badge, Box, Button, Heading, HStack, Text, VStack } from '@chakra-ui/react';
import {
  LuArrowDown,
  LuArrowUp,
  LuCalendarDays,
  LuCheck,
  LuMinus,
  LuPencil,
  LuPlay,
  LuRotateCcw,
  LuTrash2,
} from 'react-icons/lu';
import type { Task, TaskPriority, TaskStatus } from '../../types/task';
import { formatCalendarDate } from '../../utils/dates';
import { isTaskOverdue } from '../../utils/tasks';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  // The current moment for the overdue badge; pass `useToday()` so it rolls over at midnight.
  now?: Date;
}

const statusLabel: Record<TaskStatus, string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  done: 'Done',
};
// v2 accents: violet = not started, orange = in progress, teal = done.
const statusPalette: Record<TaskStatus, string> = {
  todo: 'purple',
  'in-progress': 'orange',
  done: 'teal',
};
const statusBorder: Record<TaskStatus, string> = {
  todo: 'accent.violet',
  'in-progress': 'accent.orange',
  done: 'accent.teal',
};
const priorityPalette: Record<TaskPriority, string> = {
  low: 'gray',
  medium: 'orange',
  high: 'red',
};

const PriorityIcon = ({ priority }: { priority: TaskPriority }) => {
  if (priority === 'low') return <LuArrowDown />;
  if (priority === 'high') return <LuArrowUp />;
  return <LuMinus />;
};

const TaskCard = ({ task, onEdit, onDelete, onStatusChange, now }: TaskCardProps) => {
  const overdue = isTaskOverdue(task, now);
  const borderColor = overdue ? 'red.400' : statusBorder[task.status];
  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderLeftWidth="4px"
      borderColor="border"
      borderLeftColor={borderColor}
      borderRadius="xl"
      p={{ base: 4, md: 5 }}
      transition="all 0.18s ease"
      _hover={{ transform: 'translateY(-1px)', boxShadow: 'md' }}
    >
      <VStack align="stretch" gap={4}>
        <Box>
          <HStack gap={2} mb={3} flexWrap="wrap">
            <Badge colorPalette={statusPalette[task.status]}>{statusLabel[task.status]}</Badge>
            <Badge colorPalette={priorityPalette[task.priority]}>
              <HStack gap={1}>
                <PriorityIcon priority={task.priority} />
                <Text>{task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}</Text>
              </HStack>
            </Badge>
            {overdue && <Badge colorPalette="red">Overdue</Badge>}
          </HStack>
          <Heading
            size="md"
            textDecoration={task.status === 'done' ? 'line-through' : undefined}
            opacity={task.status === 'done' ? 0.7 : 1}
          >
            {task.title}
          </Heading>
          <Text color="fg.muted" mt={2}>
            {task.description || 'No description provided.'}
          </Text>
          {task.dueDate && (
            <HStack gap={1.5} mt={3} color={overdue ? 'red.500' : 'fg.muted'} fontSize="sm">
              <LuCalendarDays />
              <Text>Due {formatCalendarDate(task.dueDate)}</Text>
            </HStack>
          )}
        </Box>
        <HStack flexWrap="wrap" gap={2}>
          {task.status === 'todo' && (
            <Button
              size="sm"
              colorPalette="teal"
              onClick={() => onStatusChange(task, 'in-progress')}
            >
              <LuPlay />
              Start Progress
            </Button>
          )}
          {task.status === 'in-progress' && (
            <Button size="sm" colorPalette="teal" onClick={() => onStatusChange(task, 'done')}>
              <LuCheck />
              Mark Done
            </Button>
          )}
          {task.status === 'done' && (
            <Button size="sm" variant="outline" onClick={() => onStatusChange(task, 'todo')}>
              <LuRotateCcw />
              Reopen
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onEdit(task)}>
            <LuPencil />
            Edit
          </Button>
          <Button size="sm" variant="ghost" colorPalette="red" onClick={() => onDelete(task)}>
            <LuTrash2 />
            Delete
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
};

export default TaskCard;
