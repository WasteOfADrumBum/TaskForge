import { Box, Button, Heading, HStack, Link, Progress, Text } from '@chakra-ui/react';
import { LuPencil, LuTrash2 } from 'react-icons/lu';
import { Link as RouterLink } from 'react-router-dom';
import { getProjectId, type Project } from '../../types/project';
import type { ProjectTaskStats } from '../../utils/projects';
import ProjectStatusBadge from './ProjectStatusBadge';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

interface ProjectCardProps {
  project: Project;
  stats: ProjectTaskStats;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}

const ProjectCard = ({ project, stats, onEdit, onDelete }: ProjectCardProps) => (
  <Box
    as="li"
    bg="bg.panel"
    borderWidth="1px"
    borderRadius="lg"
    p={{ base: 4, md: 5 }}
    opacity={project.status === 'archived' ? 0.75 : 1}
    minW="0"
  >
    <HStack justify="space-between" align="flex-start" gap={3} mb={2}>
      <Heading as="h3" size="md" minW="0">
        <Link asChild color="fg" _hover={{ color: 'accent.teal' }}>
          <RouterLink to={'/work/projects/' + getProjectId(project)}>{project.name}</RouterLink>
        </Link>
      </Heading>
      <ProjectStatusBadge status={project.status} />
    </HStack>
    <Text color="fg.muted" fontSize="sm" lineClamp={2} minH={{ md: '2.5em' }}>
      {project.description || 'No description.'}
    </Text>
    <Box mt={4}>
      <HStack justify="space-between" fontSize="xs" color="fg.muted" mb={1.5}>
        <Text>
          {stats.total
            ? `${stats.open} open · ${stats.done} done${stats.overdue ? ` · ${stats.overdue} overdue` : ''}`
            : 'No tasks yet'}
        </Text>
        {stats.total > 0 && <Text>{stats.completion}%</Text>}
      </HStack>
      <Progress.Root value={stats.completion} size="xs" colorPalette="teal">
        <Progress.Track aria-label={project.name + ' completion'}>
          <Progress.Range />
        </Progress.Track>
      </Progress.Root>
    </Box>
    <HStack justify="space-between" mt={4} gap={2} flexWrap="wrap">
      <Text fontSize="xs" color="fg.muted">
        {project.updatedAt ? 'Updated ' + dateFormat.format(new Date(project.updatedAt)) : ''}
      </Text>
      <HStack gap={1}>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => onEdit(project)}
          aria-label={'Edit ' + project.name}
        >
          <LuPencil />
          Edit
        </Button>
        <Button
          size="xs"
          variant="ghost"
          colorPalette="red"
          onClick={() => onDelete(project)}
          aria-label={'Delete ' + project.name}
        >
          <LuTrash2 />
          Delete
        </Button>
      </HStack>
    </HStack>
  </Box>
);

export default ProjectCard;
