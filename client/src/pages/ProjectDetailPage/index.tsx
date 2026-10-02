import {
  Box,
  Button,
  Heading,
  HStack,
  Link,
  Progress,
  SimpleGrid,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useMemo, useState, type ReactNode } from 'react';
import {
  LuArrowLeft,
  LuClock,
  LuFolderX,
  LuInbox,
  LuPencil,
  LuPlus,
  LuTrash2,
} from 'react-icons/lu';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import EmptyState from '../../components/common/EmptyState';
import SectionHeader from '../../components/common/SectionHeader';
import DeleteProjectDialog from '../../components/projects/DeleteProjectDialog';
import ProjectForm from '../../components/projects/ProjectForm';
import ProjectStatusBadge from '../../components/projects/ProjectStatusBadge';
import PriorityTaskRow from '../../components/tasks/PriorityTaskRow';
import WorkTabs from '../../components/work/WorkTabs';
import { useProjectActions } from '../../hooks/useProjectActions';
import { useToday } from '../../hooks/useToday';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import { getProjectId, type Project } from '../../types/project';
import { getTaskId } from '../../types/task';
import {
  getProjectActivity,
  getProjectStats,
  getStatsForProject,
  getTasksForProject,
} from '../../utils/projects';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const statusOrder = { 'in-progress': 0, todo: 1, done: 2 } as const;

const BackLink = () => (
  <Link asChild fontSize="sm" color="fg.muted" _hover={{ color: 'accent.teal' }}>
    <RouterLink to="/work/projects">
      <LuArrowLeft aria-hidden="true" />
      All projects
    </RouterLink>
  </Link>
);

const ProjectDetailPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const projects = useAppSelector((state) => state.projects.items);
  const loaded = useAppSelector((state) => state.projects.loaded);
  const loadError = useAppSelector((state) => state.projects.error);
  const tasks = useAppSelector((state) => state.tasks.items);
  const today = useToday();
  const { save, remove, saving, error, clearError } = useProjectActions();
  const [editing, setEditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const project = projects.find((item) => getProjectId(item) === id);
  const stats = useMemo(
    () => getStatsForProject(getProjectStats(tasks, today), id),
    [tasks, today, id],
  );
  const projectTasks = useMemo(
    () =>
      getTasksForProject(tasks, id).sort((a, b) => statusOrder[a.status] - statusOrder[b.status]),
    [tasks, id],
  );
  const activity = useMemo(
    () => (project ? getProjectActivity(project, tasks) : []),
    [project, tasks],
  );

  // Loading, load-error, and not-found states share the page layout: back link, heading, tabs.
  const statePage = (heading: string, body: ReactNode) => (
    <Box>
      <Box mb={{ base: 5, md: 6 }}>
        <BackLink />
        <Heading as="h1" size={{ base: '2xl', md: '3xl' }} mt={3}>
          {heading}
        </Heading>
      </Box>
      <WorkTabs />
      {body}
    </Box>
  );

  if (!loaded) {
    return statePage(
      'Project',
      loadError ? (
        <Box borderWidth="1px" borderColor="border.error" bg="bg.error" borderRadius="md" p={3}>
          <Text color="fg.error">{loadError}</Text>
        </Box>
      ) : (
        <Text color="fg.muted">Loading project...</Text>
      ),
    );
  }

  if (!project) {
    return statePage(
      'Project not found',
      <Box bg="bg.panel" borderWidth="1px" borderRadius="lg">
        <EmptyState
          icon={<LuFolderX size={24} />}
          title="This project doesn't exist"
          description="It may have been deleted, or the link is wrong."
        />
      </Box>,
    );
  }

  const handleSubmit = async (input: Parameters<typeof save>[0]) => {
    const saved = await save(input, project);
    if (saved) setEditing(false);
    return Boolean(saved);
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (await remove(deleteTarget)) {
      setDeleteTarget(null);
      navigate('/work/projects');
    }
  };

  return (
    <Box>
      <Box mb={{ base: 5, md: 6 }}>
        <BackLink />
        <HStack mt={3} gap={3} flexWrap="wrap" align="center">
          <Heading as="h1" size={{ base: '2xl', md: '3xl' }} minW="0" wordBreak="break-word">
            {project.name}
          </Heading>
          <ProjectStatusBadge status={project.status} />
        </HStack>
        {project.description && (
          <Text color="fg.muted" mt={2} whiteSpace="pre-wrap">
            {project.description}
          </Text>
        )}
        <HStack mt={4} gap={2} flexWrap="wrap">
          <Button
            size="sm"
            colorPalette="teal"
            onClick={() => navigate('/work', { state: { newTask: Date.now(), projectId: id } })}
          >
            <LuPlus />
            New task in project
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              clearError();
              setEditing(true);
            }}
            disabled={editing}
          >
            <LuPencil />
            Edit project
          </Button>
          <Button
            size="sm"
            variant="ghost"
            colorPalette="red"
            onClick={() => setDeleteTarget(project)}
          >
            <LuTrash2 />
            Delete
          </Button>
        </HStack>
      </Box>
      <WorkTabs />

      {editing && (
        <Box mb={6} maxW="2xl">
          <ProjectForm
            project={project}
            saving={saving}
            error={error}
            onSubmit={handleSubmit}
            onCancel={() => {
              clearError();
              setEditing(false);
            }}
          />
        </Box>
      )}

      <SimpleGrid columns={{ base: 1, xl: 3 }} gap={6} alignItems="start">
        <VStack align="stretch" gap={6} gridColumn={{ xl: 'span 2' }} minW="0">
          <Box
            as="section"
            aria-labelledby="project-tasks-heading"
            bg="bg.panel"
            borderWidth="1px"
            borderRadius="lg"
            p={{ base: 4, md: 5 }}
          >
            <SectionHeader
              id="project-tasks-heading"
              title="Tasks"
              count={projectTasks.length}
              action={{ label: 'Open Work', to: '/work' }}
            />
            {projectTasks.length ? (
              <Box as="ul" listStyleType="none" m={0} p={0}>
                {projectTasks.map((task) => (
                  <PriorityTaskRow key={getTaskId(task)} task={task} />
                ))}
              </Box>
            ) : (
              <EmptyState
                icon={<LuInbox size={24} />}
                title="No tasks in this project yet"
                description="Add one with “New task in project”, or pick this project when editing a task."
              />
            )}
          </Box>

          <Box
            as="section"
            aria-labelledby="project-activity-heading"
            bg="bg.panel"
            borderWidth="1px"
            borderRadius="lg"
            p={{ base: 4, md: 5 }}
          >
            <SectionHeader id="project-activity-heading" title="Recent activity" />
            {activity.length ? (
              <Box as="ol" listStyleType="none" m={0} p={0}>
                {activity.map((item) => (
                  <HStack
                    as="li"
                    key={item.id}
                    align="flex-start"
                    gap={3}
                    py={2.5}
                    borderTopWidth="1px"
                    borderColor="border.muted"
                  >
                    <Box
                      boxSize="2"
                      mt={1.5}
                      borderRadius="sm"
                      bg={item.kind === 'project' ? 'accent.violet' : 'accent.teal'}
                      flexShrink={0}
                      aria-hidden="true"
                    />
                    <Box minW="0">
                      <Text fontSize="sm" lineClamp={2}>
                        {item.label}
                      </Text>
                      <Text fontSize="xs" color="fg.muted">
                        <time dateTime={item.at}>{timeFormat.format(new Date(item.at))}</time>
                      </Text>
                    </Box>
                  </HStack>
                ))}
              </Box>
            ) : (
              <EmptyState icon={<LuClock size={24} />} title="No activity yet" />
            )}
          </Box>
        </VStack>

        <Box
          as="section"
          aria-labelledby="project-details-heading"
          bg="bg.panel"
          borderWidth="1px"
          borderRadius="lg"
          p={{ base: 4, md: 5 }}
          minW="0"
        >
          <SectionHeader id="project-details-heading" title="Details" />
          <Progress.Root value={stats.completion} colorPalette="teal" size="sm">
            <HStack justify="space-between" mb={2}>
              <Progress.Label fontSize="sm" color="fg.muted">
                Completion
              </Progress.Label>
              <Progress.ValueText fontSize="sm" />
            </HStack>
            <Progress.Track aria-label={project.name + ' completion'}>
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>
          <SimpleGrid as="dl" columns={2} gap={4} mt={5}>
            {[
              ['Open tasks', String(stats.open)],
              ['Done', String(stats.done)],
              ['In progress', String(stats.inProgress)],
              ['Overdue', String(stats.overdue)],
              ['Created', project.createdAt ? dateFormat.format(new Date(project.createdAt)) : '—'],
              ['Updated', project.updatedAt ? dateFormat.format(new Date(project.updatedAt)) : '—'],
            ].map(([label, value]) => (
              <Box key={label}>
                <Text as="dt" fontSize="xs" color="fg.muted">
                  {label}
                </Text>
                <Text as="dd" fontWeight="semibold" m={0}>
                  {value}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </Box>
      </SimpleGrid>

      <DeleteProjectDialog
        project={deleteTarget}
        taskCount={stats.total}
        loading={saving}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </Box>
  );
};

export default ProjectDetailPage;
