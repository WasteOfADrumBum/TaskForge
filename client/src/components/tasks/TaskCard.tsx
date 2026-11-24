import { Badge, Button, type BadgeProps } from '@onesmall/ui';
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
import styles from './TaskCard.module.css';

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
// v2 accents: violet = not started, orange = in progress, teal = done. The card's left edge
// uses the same colors (TaskCard.module.css).
const statusPalette: Record<TaskStatus, BadgeProps['color']> = {
  todo: 'accent',
  'in-progress': 'secondary',
  done: 'primary',
};
const priorityPalette: Record<TaskPriority, BadgeProps['color']> = {
  low: 'neutral',
  medium: 'secondary',
  high: 'danger',
};

const PriorityIcon = ({ priority }: { priority: TaskPriority }) => {
  if (priority === 'low') return <LuArrowDown aria-hidden="true" />;
  if (priority === 'high') return <LuArrowUp aria-hidden="true" />;
  return <LuMinus aria-hidden="true" />;
};

const metaRowClass = 'os-flex os-items-center os-gap-1';

// Who the task is assigned to. An agent that isn't loaded (still loading, failed to load, or
// deleted) is shown without a name rather than hiding the assignment.
const AssigneeLabel = ({ task, agent }: { task: Task; agent?: Agent }) => {
  const assignee = getTaskAssignee(task);
  if (assignee.kind === 'agent') {
    if (!agent) {
      return (
        <div className={metaRowClass + ' os-text-muted'}>
          <LuBot aria-hidden="true" />
          <p className="os-m-0">Assigned to an agent</p>
        </div>
      );
    }
    return (
      <div className="os-flex os-items-center os-gap-2">
        <RouterLink to={'/workforce/' + getAgentId(agent)} className={styles.metaLink}>
          <LuBot aria-hidden="true" />
          Agent: {agent.name}
        </RouterLink>
        {agent.status !== 'active' && <AgentStatusBadge status={agent.status} />}
      </div>
    );
  }
  return (
    <div className={metaRowClass + ' os-text-muted'}>
      {assignee.kind === 'me' ? (
        <LuUserRound aria-hidden="true" />
      ) : (
        <LuUserRoundX aria-hidden="true" />
      )}
      <p className="os-m-0">{assignee.kind === 'me' ? 'Assigned to me' : 'Unassigned'}</p>
    </div>
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
  return (
    <div className={styles.card} data-status={task.status} data-overdue={overdue || undefined}>
      <div className="os-flex os-flex-col os-gap-4">
        <div className={styles.body}>
          <div className="os-flex os-flex-wrap os-gap-2 os-mb-3">
            <Badge color={statusPalette[task.status]}>{statusLabel[task.status]}</Badge>
            <Badge color={priorityPalette[task.priority]}>
              <span className="os-inline-flex os-items-center os-gap-1">
                <PriorityIcon priority={task.priority} />
                <span>{task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}</span>
              </span>
            </Badge>
            {overdue && <Badge color="danger">Overdue</Badge>}
          </div>
          <h2
            className={
              'tf-h3 os-m-0 ' + styles.title + (task.status === 'done' ? ' os-line-through' : '')
            }
          >
            {task.title}
          </h2>
          <p className="os-text-muted os-mt-2 os-mb-0">
            {task.description || 'No description provided.'}
          </p>
          <div className="os-flex os-flex-wrap os-items-center os-gap-x-4 os-gap-y-1 os-mt-3 os-text-sm">
            <AssigneeLabel task={task} agent={agent} />
            {task.dueDate && (
              <div className={metaRowClass + (overdue ? ' os-text-danger' : ' os-text-muted')}>
                <LuCalendarDays aria-hidden="true" />
                <p className="os-m-0">Due {formatCalendarDate(task.dueDate)}</p>
              </div>
            )}
            {project && (
              <RouterLink
                to={'/work/projects/' + getProjectId(project)}
                className={styles.metaLink}
              >
                <LuFolderKanban aria-hidden="true" />
                {project.name}
              </RouterLink>
            )}
          </div>
        </div>
        <div className="os-flex os-flex-wrap os-gap-2">
          {task.status === 'todo' && (
            <Button
              size="sm"
              color="primary"
              onClick={() => onStatusChange(task, 'in-progress')}
              leftIcon={<LuPlay />}
            >
              Start Progress
            </Button>
          )}
          {task.status === 'in-progress' && (
            <Button
              size="sm"
              color="primary"
              onClick={() => onStatusChange(task, 'done')}
              leftIcon={<LuCheck />}
            >
              Mark Done
            </Button>
          )}
          {task.status === 'done' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusChange(task, 'todo')}
              leftIcon={<LuRotateCcw />}
            >
              Reopen
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onEdit(task)} leftIcon={<LuPencil />}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            color="danger"
            onClick={() => onDelete(task)}
            leftIcon={<LuTrash2 />}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
