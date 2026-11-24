import { Badge, type BadgeProps } from '@onesmall/ui';
import { projectStatusLabel, type ProjectStatus } from '../../types/project';

const palette: Record<ProjectStatus, BadgeProps['color']> = {
  active: 'primary',
  completed: 'accent',
  archived: 'neutral',
};

const ProjectStatusBadge = ({ status }: { status: ProjectStatus }) => (
  <Badge color={palette[status]}>{projectStatusLabel[status]}</Badge>
);

export default ProjectStatusBadge;
