import { Badge, Box, Button, Heading, HStack, Link, Text, VStack } from '@chakra-ui/react';
import {
  LuArrowDown,
  LuArrowUp,
  LuBot,
  LuCalendarDays,
  LuCheck,
  LuFolderKanban,
  LuMinus,
  LuPencil,
  LuPlay,
  LuRotateCcw,
  LuTrash2,
  LuUserRound,
  LuUserRoundX,
} from 'react-icons/lu';
import { Link as RouterLink } from 'react-router-dom';
import { getAgentId, type Agent } from '../../types/agent';
import { getProjectId, type Project } from '../../types/project';
import type { Task, TaskPriority, TaskStatus } from '../../types/task';
import { getTaskAssignee } from '../../utils/assignees';
import { formatCalendarDate } from '../../utils/dates';
import { isTaskOverdue } from '../../utils/tasks';
import AgentStatusBadge from '../agents/AgentStatusBadge';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  // The current moment for the overdue badge; pass `useToday()` so it rolls over at midnight.
  now?: Date;
  // The task's project, when it has one. Rendered as a link, so it needs a router.
  project?: Project;
  // The task's agent assignee, when it has one and the agent is loaded. Rendered as a link.
  agent?: Agent;
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

const metaLinkProps = {
  color: 'fg.muted',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 1.5,
  _hover: { color: 'accent.teal' },
} as const;

// Who the task is assigned to. An agent that isn't loaded (still loading, failed to load, or
// deleted) is shown without a name rather than hiding the assignment.
const AssigneeLabel = ({ task, agent }: { task: Task; agent?: Agent }) => {
  const assignee = getTaskAssignee(task);
  if (assignee.kind === 'agent') {
    if (!agent) {
      return (
        <HStack gap={1.5} color="fg.muted">
          <LuBot aria-hidden="true" />
          <Text>Assigned to an agent</Text>
        </HStack>
      );
    }
    return (
      <HStack gap={2}>
        <Link asChild {...metaLinkProps}>
          <RouterLink to={'/workforce/' + getAgentId(agent)}>
            <LuBot aria-hidden="true" />
            Agent: {agent.name}
          </RouterLink>
        </Link>
        {agent.status !== 'active' && <AgentStatusBadge status={agent.status} />}
      </HStack>
    );
  }
  return (
    <HStack gap={1.5} color="fg.muted">
      {assignee.kind === 'me' ? (
        <LuUserRound aria-hidden="true" />
      ) : (
        <LuUserRoundX aria-hidden="true" />
      )}
      <Text>{assignee.kind === 'me' ? 'Assigned to me' : 'Unassigned'}</Text>
    </HStack>
  );
};

const TaskCard = ({
  task,
  onEdit,
  onDelete,
  onStatusChange,
  now,
  project,
  agent,
}: TaskCardProps) => {
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
          <HStack gap={4} rowGap={1.5} mt={3} fontSize="sm" flexWrap="wrap">
            <AssigneeLabel task={task} agent={agent} />
            {task.dueDate && (
              <HStack gap={1.5} color={overdue ? 'red.500' : 'fg.muted'}>
                <LuCalendarDays aria-hidden="true" />
                <Text>Due {formatCalendarDate(task.dueDate)}</Text>
              </HStack>
            )}
            {project && (
              <Link asChild {...metaLinkProps}>
                <RouterLink to={'/work/projects/' + getProjectId(project)}>
                  <LuFolderKanban aria-hidden="true" />
                  {project.name}
                </RouterLink>
              </Link>
            )}
          </HStack>
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
