import {
  Badge,
  Box,
  Heading,
  HStack,
  Link,
  Progress,
  SimpleGrid,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useMemo } from 'react';
import {
  LuCircleCheck,
  LuClock,
  LuListTodo,
  LuLoaderCircle,
  LuSignpost,
  LuTriangleAlert,
} from 'react-icons/lu';
import { Link as RouterLink } from 'react-router-dom';
import EmptyState from '../../components/common/EmptyState';
import MetricCard from '../../components/common/MetricCard';
import SectionHeader from '../../components/common/SectionHeader';
import PriorityTaskRow from '../../components/tasks/PriorityTaskRow';
import { useToday } from '../../hooks/useToday';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import { getProjectId } from '../../types/project';
import { getTaskId } from '../../types/task';
import { getAgentSummary } from '../../utils/agents';
import { getProjectStats, getStatsForProject } from '../../utils/projects';
import {
  getGreeting,
  getRecentActivity,
  getRecommendations,
  getTodaysPriorities,
} from '../../utils/commandCenter';
import { getTaskSummary } from '../../utils/tasks';

const toneColor = { teal: 'accent.teal', orange: 'accent.orange', violet: 'accent.violet' };
const toneBg = {
  teal: 'accent.tealSubtle',
  orange: 'accent.orangeSubtle',
  violet: 'accent.violetSubtle',
};
const timeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const CommandCenterPage = () => {
  const tasks = useAppSelector((state) => state.tasks.items);
  const loading = useAppSelector((state) => state.tasks.loading);
  const error = useAppSelector((state) => state.tasks.error);
  // One `now` for every section, so the Overdue metric and the priorities always agree. It
  // advances when the local day changes, so a tab left open past midnight stays correct.
  const now = useToday();
  const summary = useMemo(() => getTaskSummary(tasks, now), [tasks, now]);
  // Count from the full list; only the panel shows the top five.
  const allPriorities = useMemo(
    () => getTodaysPriorities(tasks, now, Number.POSITIVE_INFINITY),
    [tasks, now],
  );
  const priorities = allPriorities.slice(0, 5);
  const recommendations = useMemo(() => getRecommendations(tasks, now), [tasks, now]);
  const activity = useMemo(() => getRecentActivity(tasks), [tasks]);
  const projects = useAppSelector((state) => state.projects.items);
  const activeProjects = useMemo(
    () => projects.filter((project) => project.status === 'active'),
    [projects],
  );
  const projectStats = useMemo(() => getProjectStats(tasks, now), [tasks, now]);
  const agents = useAppSelector((state) => state.agents.items);
  const agentSummary = useMemo(() => getAgentSummary(agents), [agents]);
  const initialLoad = loading && tasks.length === 0;
  const open = summary.todo + summary.inProgress;
  const completion = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;
  const attention = allPriorities.filter(
    (item) => item.reason === 'overdue' || item.reason === 'due-today',
  ).length;

  return (
    <VStack align="stretch" gap={{ base: 6, md: 8 }}>
      <Box>
        <Text
          color="accent.teal"
          fontSize="xs"
          fontWeight="semibold"
          letterSpacing="widest"
          textTransform="uppercase"
        >
          Your daily brief
        </Text>
        <Heading as="h1" size={{ base: '2xl', md: '3xl' }} mt={1.5}>
          {getGreeting(now)}.
        </Heading>
        <Text color="fg.muted" mt={1.5}>
          {initialLoad ? (
            'Loading your workspace...'
          ) : (
            <>
              {attention
                ? (attention === 1 ? '1 task needs' : attention + ' tasks need') +
                  ' your attention today.'
                : 'Nothing is overdue or due today.'}{' '}
              {open} open {open === 1 ? 'task' : 'tasks'} in your workspace.
            </>
          )}
        </Text>
      </Box>

      {error && (
        <Box borderWidth="1px" borderColor="border.error" bg="bg.error" borderRadius="md" p={3}>
          <Text color="fg.error">{error}</Text>
        </Box>
      )}

      <SimpleGrid as="section" aria-label="Task metrics" columns={{ base: 2, xl: 4 }} gap={4}>
        <MetricCard
          label="Open tasks"
          value={open}
          detail={summary.todo + ' to do'}
          icon={LuListTodo}
          accent="accent.teal"
        />
        <MetricCard
          label="In progress"
          value={summary.inProgress}
          detail="Started and not finished"
          icon={LuLoaderCircle}
          accent="accent.violet"
        />
        <MetricCard
          label="Completed"
          value={summary.done}
          detail={completion + '% of all tasks'}
          icon={LuCircleCheck}
          accent="accent.teal"
        />
        <MetricCard
          label="Overdue"
          value={summary.overdue}
          detail={summary.overdue ? 'Past their due date' : 'All caught up'}
          icon={LuTriangleAlert}
          accent="accent.orange"
        />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, xl: 3 }} gap={{ base: 6, md: 6 }} alignItems="start">
        <VStack align="stretch" gap={6} gridColumn={{ xl: 'span 2' }} minW="0">
          <Box
            as="section"
            aria-labelledby="priorities-heading"
            bg="bg.panel"
            borderWidth="1px"
            borderRadius="lg"
            p={{ base: 4, md: 5 }}
          >
            <SectionHeader
              id="priorities-heading"
              title="Today's priorities"
              count={allPriorities.length}
              action={{ label: 'View all work', to: '/work' }}
            />
            {initialLoad ? (
              <Text color="fg.muted">Loading priorities...</Text>
            ) : priorities.length ? (
              <Box as="ul" listStyleType="none" m={0} p={0}>
                {priorities.map(({ task, reason }) => (
                  <PriorityTaskRow key={getTaskId(task)} task={task} reason={reason} />
                ))}
              </Box>
            ) : (
              <EmptyState
                icon={<LuCircleCheck size={24} />}
                title="Nothing urgent"
                description="No overdue, due-soon, or high-priority open tasks. Open Work to choose your next task."
              />
            )}
          </Box>

          <Box
            as="section"
            aria-labelledby="activity-heading"
            bg="bg.panel"
            borderWidth="1px"
            borderRadius="lg"
            p={{ base: 4, md: 5 }}
          >
            <SectionHeader id="activity-heading" title="Recent task changes" />
            {initialLoad ? (
              <Text color="fg.muted">Loading recent changes...</Text>
            ) : activity.length ? (
              <Box as="ol" listStyleType="none" m={0} p={0}>
                {activity.map(({ task, action, at }) => (
                  <HStack
                    as="li"
                    key={getTaskId(task) + at}
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
                      bg={action === 'created' ? 'accent.teal' : 'accent.violet'}
                      flexShrink={0}
                      aria-hidden="true"
                    />
                    <Box minW="0">
                      <Text fontSize="sm" lineClamp={2}>
                        {action === 'created' ? 'Created' : 'Updated'} &ldquo;{task.title}&rdquo;
                      </Text>
                      <Text fontSize="xs" color="fg.muted">
                        <time dateTime={at}>{timeFormat.format(new Date(at))}</time>
                      </Text>
                    </Box>
                  </HStack>
                ))}
              </Box>
            ) : (
              <EmptyState
                icon={<LuClock size={24} />}
                title="No activity yet"
                description="Task creations and updates will appear here."
              />
            )}
          </Box>
        </VStack>

        <VStack align="stretch" gap={6} minW="0">
          {activeProjects.length > 0 && (
            <Box
              as="section"
              aria-labelledby="active-projects-heading"
              bg="bg.panel"
              borderWidth="1px"
              borderRadius="lg"
              p={{ base: 4, md: 5 }}
            >
              <SectionHeader
                id="active-projects-heading"
                title="Active projects"
                count={activeProjects.length}
                action={{ label: 'All projects', to: '/work/projects' }}
              />
              <Box as="ul" listStyleType="none" m={0} p={0}>
                {activeProjects.slice(0, 4).map((project) => {
                  const stats = getStatsForProject(projectStats, getProjectId(project));
                  return (
                    <Box
                      as="li"
                      key={getProjectId(project)}
                      py={3}
                      borderTopWidth="1px"
                      borderColor="border.muted"
                    >
                      <HStack justify="space-between" gap={3} mb={1.5}>
                        <Link
                          asChild
                          fontSize="sm"
                          fontWeight="medium"
                          color="fg"
                          minW="0"
                          _hover={{ color: 'accent.teal' }}
                        >
                          <RouterLink to={'/work/projects/' + getProjectId(project)}>
                            <Text as="span" truncate>
                              {project.name}
                            </Text>
                          </RouterLink>
                        </Link>
                        <Text fontSize="xs" color="fg.muted" flexShrink={0}>
                          {stats.total ? `${stats.open} open` : 'No tasks'}
                        </Text>
                      </HStack>
                      {stats.total > 0 && (
                        <Progress.Root value={stats.completion} size="xs" colorPalette="teal">
                          <Progress.Track aria-label={project.name + ' completion'}>
                            <Progress.Range />
                          </Progress.Track>
                        </Progress.Root>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}

          {agentSummary.total > 0 && (
            <Box
              as="section"
              aria-labelledby="workforce-heading"
              bg="bg.panel"
              borderWidth="1px"
              borderRadius="lg"
              p={{ base: 4, md: 5 }}
            >
              <SectionHeader
                id="workforce-heading"
                title="Workforce"
                count={agentSummary.total}
                action={{ label: 'Open Workforce', to: '/workforce' }}
              />
              <SimpleGrid as="dl" columns={3} gap={3} textAlign="center">
                {[
                  { label: 'Active', value: agentSummary.active },
                  { label: 'Paused', value: agentSummary.paused },
                  { label: 'Disabled', value: agentSummary.disabled },
                ].map((item) => (
                  <Box
                    key={item.label}
                    display="flex"
                    flexDirection="column-reverse"
                    bg="bg.muted"
                    borderRadius="md"
                    py={3}
                  >
                    <Text as="dt" fontSize="xs" color="fg.muted">
                      {item.label}
                    </Text>
                    <Text as="dd" fontSize="xl" fontWeight="semibold" m={0}>
                      {item.value}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>
              <Text fontSize="xs" color="fg.muted" mt={3}>
                Agent definitions only. Agents don’t run yet.
              </Text>
            </Box>
          )}

          <Box
            as="section"
            aria-labelledby="summary-heading"
            bg="bg.panel"
            borderWidth="1px"
            borderRadius="lg"
            p={{ base: 4, md: 5 }}
          >
            <SectionHeader id="summary-heading" title="Task summary" />
            <Progress.Root value={completion} colorPalette="teal" size="sm">
              <HStack justify="space-between" mb={2}>
                <Progress.Label fontSize="sm" color="fg.muted">
                  Completion
                </Progress.Label>
                <Progress.ValueText fontSize="sm" />
              </HStack>
              <Progress.Track>
                <Progress.Range />
              </Progress.Track>
            </Progress.Root>
            <SimpleGrid as="dl" columns={3} gap={3} mt={5} textAlign="center">
              {[
                { label: 'To do', value: summary.todo },
                { label: 'In progress', value: summary.inProgress },
                { label: 'Done', value: summary.done },
              ].map((item) => (
                <Box
                  key={item.label}
                  display="flex"
                  flexDirection="column-reverse"
                  bg="bg.muted"
                  borderRadius="md"
                  py={3}
                >
                  <Text as="dt" fontSize="xs" color="fg.muted">
                    {item.label}
                  </Text>
                  <Text as="dd" fontSize="xl" fontWeight="semibold" m={0}>
                    {item.value}
                  </Text>
                </Box>
              ))}
            </SimpleGrid>
          </Box>

          <Box as="section" aria-labelledby="recommendations-heading">
            <SectionHeader
              id="recommendations-heading"
              title="Recommended next"
              icon={<LuSignpost aria-hidden="true" />}
              aside={
                <Badge variant="outline" size="sm" title="Generated from task data by fixed rules">
                  Rule based
                </Badge>
              }
            />
            {recommendations.length ? (
              <VStack as="ul" listStyleType="none" align="stretch" gap={3} m={0} p={0}>
                {recommendations.map((item) => (
                  <Box as="li" key={item.id}>
                    <Link
                      asChild
                      display="block"
                      borderWidth="1px"
                      borderRadius="md"
                      borderLeftWidth="3px"
                      borderLeftColor={toneColor[item.tone]}
                      bg={toneBg[item.tone]}
                      p={4}
                      textDecoration="none"
                      _hover={{ borderColor: toneColor[item.tone] }}
                    >
                      <RouterLink to="/work">
                        <Text fontSize="sm" fontWeight="semibold" color="fg">
                          {item.title}
                        </Text>
                        <Text fontSize="sm" color="fg.muted" mt={1}>
                          {item.reason}
                        </Text>
                      </RouterLink>
                    </Link>
                  </Box>
                ))}
              </VStack>
            ) : (
              <Text color="fg.muted" fontSize="sm">
                No recommendations right now. Your open work is on track.
              </Text>
            )}
          </Box>
        </VStack>
      </SimpleGrid>
    </VStack>
  );
};

export default CommandCenterPage;
