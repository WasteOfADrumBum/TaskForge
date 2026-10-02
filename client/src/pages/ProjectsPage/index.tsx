import { Box, Heading, SimpleGrid, Text } from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import { LuFolderKanban } from 'react-icons/lu';
import EmptyState from '../../components/common/EmptyState';
import DeleteProjectDialog from '../../components/projects/DeleteProjectDialog';
import ProjectCard from '../../components/projects/ProjectCard';
import ProjectForm from '../../components/projects/ProjectForm';
import WorkTabs from '../../components/work/WorkTabs';
import { useProjectActions } from '../../hooks/useProjectActions';
import { useToday } from '../../hooks/useToday';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import { getProjectId, type Project } from '../../types/project';
import { getProjectStats, getStatsForProject, sortProjects } from '../../utils/projects';

const ProjectsPage = () => {
  const projects = useAppSelector((state) => state.projects.items);
  const loading = useAppSelector((state) => state.projects.loading);
  const loaded = useAppSelector((state) => state.projects.loaded);
  const loadError = useAppSelector((state) => state.projects.error);
  const tasks = useAppSelector((state) => state.tasks.items);
  const today = useToday();
  const { save, remove, saving, error, clearError } = useProjectActions();
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const sorted = useMemo(() => sortProjects(projects), [projects]);
  const stats = useMemo(() => getProjectStats(tasks, today), [tasks, today]);

  const startEdit = (project: Project) => {
    clearError();
    setEditing(project);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const cancelEdit = () => {
    clearError();
    setEditing(null);
  };
  const handleSubmit = async (input: Parameters<typeof save>[0]) => {
    const saved = await save(input, editing ?? undefined);
    if (saved && editing) setEditing(null);
    return Boolean(saved);
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const deleted = await remove(deleteTarget);
    if (!deleted) return;
    if (editing && getProjectId(editing) === getProjectId(deleteTarget)) setEditing(null);
    setDeleteTarget(null);
  };

  return (
    <Box>
      <Box mb={{ base: 5, md: 6 }}>
        <Text
          color="accent.teal"
          fontSize="xs"
          fontWeight="semibold"
          letterSpacing="widest"
          textTransform="uppercase"
        >
          Work
        </Text>
        <Heading as="h1" size={{ base: '2xl', md: '3xl' }} mt={1.5}>
          Projects
        </Heading>
        <Text color="fg.muted" mt={1.5}>
          Group related tasks and track progress toward a goal.
        </Text>
      </Box>
      <WorkTabs />
      <SimpleGrid columns={{ base: 1, xl: 3 }} gap={6} alignItems="start">
        <ProjectForm
          key={editing ? getProjectId(editing) : 'new'}
          project={editing ?? undefined}
          saving={saving}
          error={error}
          onSubmit={handleSubmit}
          onCancel={editing ? cancelEdit : undefined}
        />
        <Box
          as="section"
          aria-labelledby="project-list-heading"
          gridColumn={{ xl: 'span 2' }}
          minW="0"
        >
          <Heading as="h2" id="project-list-heading" size="lg" mb={1}>
            Your Projects
          </Heading>
          <Text color="fg.muted" fontSize="sm" mb={4} minH="1.25em">
            {loaded && `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`}
          </Text>
          {loadError && (
            <Box
              borderWidth="1px"
              borderColor="border.error"
              bg="bg.error"
              borderRadius="md"
              p={3}
              mb={4}
            >
              <Text color="fg.error">{loadError}</Text>
            </Box>
          )}
          {!loaded && loading && (
            <Box bg="bg.panel" borderWidth="1px" borderRadius="lg" p={8} textAlign="center">
              <Text color="fg.muted">Loading your projects...</Text>
            </Box>
          )}
          {loaded && projects.length === 0 && (
            <Box bg="bg.panel" borderWidth="1px" borderRadius="lg">
              <EmptyState
                icon={<LuFolderKanban size={24} />}
                title="No projects yet"
                description="Create a project to group related tasks and see progress at a glance."
              />
            </Box>
          )}
          {projects.length > 0 && (
            <SimpleGrid
              as="ul"
              listStyleType="none"
              m={0}
              p={0}
              columns={{ base: 1, md: 2 }}
              gap={4}
            >
              {sorted.map((project) => (
                <ProjectCard
                  key={getProjectId(project)}
                  project={project}
                  stats={getStatsForProject(stats, getProjectId(project))}
                  onEdit={startEdit}
                  onDelete={setDeleteTarget}
                />
              ))}
            </SimpleGrid>
          )}
        </Box>
      </SimpleGrid>
      <DeleteProjectDialog
        project={deleteTarget}
        taskCount={deleteTarget ? getStatsForProject(stats, getProjectId(deleteTarget)).total : 0}
        loading={saving}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </Box>
  );
};

export default ProjectsPage;
