import { Badge } from '@chakra-ui/react';
import { projectStatusLabel, type ProjectStatus } from '../../types/project';

const palette: Record<ProjectStatus, string> = {
  active: 'teal',
  completed: 'purple',
  archived: 'gray',
};

const ProjectStatusBadge = ({ status }: { status: ProjectStatus }) => (
  <Badge colorPalette={palette[status]} variant="subtle">
    {projectStatusLabel[status]}
  </Badge>
);

export default ProjectStatusBadge;
