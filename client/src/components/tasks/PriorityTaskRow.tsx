import { Badge, type BadgeProps } from '@onesmall/ui';
import {
  LuCalendarDays,
  LuCircle,
  LuCircleCheck,
  LuFolderKanban,
  LuLoaderCircle,
} from 'react-icons/lu';
import { Link as RouterLink } from 'react-router-dom';
import { getProjectId, type Project } from '../../types/project';
import type { Task, TaskStatus } from '../../types/task';
import type { PriorityReason } from '../../utils/commandCenter';
import { formatCalendarDate } from '../../utils/dates';
import styles from './PriorityTaskRow.module.css';

const reasonLabel: Record<PriorityReason, string> = {
  overdue: 'Overdue',
  'due-today': 'Due today',
  'high-priority': 'High priority',
  'due-soon': 'Due soon',
};
const reasonPalette: Record<PriorityReason, BadgeProps['color']> = {
  overdue: 'danger',
  'due-today': 'secondary',
  'high-priority': 'secondary',
  'due-soon': 'accent',
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
  // The task's project, shown as a link when given. Needs a router.
  project?: Project;
}

const PriorityTaskRow = ({ task, reason, project }: PriorityTaskRowProps) => (
  <li className="os-flex os-items-start os-gap-3 os-py-3 os-border-top os-flex-wrap sm:os-flex-nowrap">
    <span
      className={(task.status === 'todo' ? 'os-text-muted ' : 'os-text-primary ') + styles.icon}
      aria-hidden="true"
    >
      <StatusIcon status={task.status} />
    </span>
    <div className="os-flex-1 os-min-w-0">
      <p className="os-text-sm os-font-medium os-line-clamp-2 os-m-0">{task.title}</p>
      <div className="os-flex os-flex-wrap os-items-center os-gap-3 os-mt-1 os-text-muted os-text-xs">
        <span>{statusLabel[task.status]}</span>
        {task.dueDate && (
          <span className="os-flex os-items-center os-gap-1">
            <LuCalendarDays aria-hidden="true" />
            <span>Due {formatCalendarDate(task.dueDate)}</span>
          </span>
        )}
        {project && (
          <RouterLink to={'/work/projects/' + getProjectId(project)} className={styles.projectLink}>
            <LuFolderKanban aria-hidden="true" />
            {project.name}
          </RouterLink>
        )}
      </div>
    </div>
    <div className={'os-flex os-items-center os-gap-2 ' + styles.badges}>
      {reason && <Badge color={reasonPalette[reason]}>{reasonLabel[reason]}</Badge>}
      {reason !== 'high-priority' && (
        <Badge color="neutral" variant="outline" className={styles.capitalize}>
          {task.priority}
        </Badge>
      )}
    </div>
  </li>
);

export default PriorityTaskRow;
