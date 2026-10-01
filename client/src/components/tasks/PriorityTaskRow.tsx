import { Badge, Box, HStack, Text } from '@chakra-ui/react';
import { LuCalendarDays, LuCircle, LuCircleCheck, LuLoaderCircle } from 'react-icons/lu';
import type { Task, TaskStatus } from '../../types/task';
import type { PriorityReason } from '../../utils/commandCenter';

const reasonLabel: Record<PriorityReason, string> = {
  overdue: 'Overdue',
  'due-today': 'Due today',
  'high-priority': 'High priority',
  'due-soon': 'Due soon',
};
const reasonPalette: Record<PriorityReason, string> = {
  overdue: 'red',
  'due-today': 'orange',
  'high-priority': 'orange',
  'due-soon': 'purple',
};
const statusLabel: Record<TaskStatus, string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  done: 'Done',
};

const StatusIcon = ({ status }: { status: TaskStatus }) => {
  if (status === 'done') return <LuCircleCheck size={18} />;
  if (status === 'in-progress') return <LuLoaderCircle size={18} />;
  return <LuCircle size={18} />;
};

interface PriorityTaskRowProps {
  task: Task;
  reason?: PriorityReason;
}

const PriorityTaskRow = ({ task, reason }: PriorityTaskRowProps) => (
  <HStack
    as="li"
    gap={3}
    py={3.5}
    borderTopWidth="1px"
    borderColor="border.muted"
    align="flex-start"
    flexWrap={{ base: 'wrap', sm: 'nowrap' }}
  >
    <Box color={task.status === 'todo' ? 'fg.muted' : 'accent.teal'} pt={0.5} aria-hidden="true">
      <StatusIcon status={task.status} />
    </Box>
    <Box flex="1" minW="0">
      <Text fontSize="sm" fontWeight="medium" lineClamp={2}>
        {task.title}
      </Text>
      <HStack gap={3} mt={1} color="fg.muted" fontSize="xs" flexWrap="wrap">
        <Text>{statusLabel[task.status]}</Text>
        {task.dueDate && (
          <HStack gap={1}>
            <LuCalendarDays aria-hidden="true" />
            <Text>Due {new Date(task.dueDate).toLocaleDateString()}</Text>
          </HStack>
        )}
      </HStack>
    </Box>
    <HStack gap={2} flexShrink={0} ml={{ base: 7, sm: 0 }}>
      {reason && (
        <Badge colorPalette={reasonPalette[reason]} variant="subtle">
          {reasonLabel[reason]}
        </Badge>
      )}
      {reason !== 'high-priority' && (
        <Badge variant="outline" textTransform="capitalize">
          {task.priority}
        </Badge>
      )}
    </HStack>
  </HStack>
);

export default PriorityTaskRow;
