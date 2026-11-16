import { Box, Button, Heading, HStack, SimpleGrid, Table, Text, VStack } from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import { LuCalendarCheck, LuCircleCheck, LuCirclePlus, LuGauge } from 'react-icons/lu';
import EmptyState from '../../components/common/EmptyState';
import MetricCard from '../../components/common/MetricCard';
import SectionHeader from '../../components/common/SectionHeader';
import { useToday } from '../../hooks/useToday';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import { PROGRESS_RANGES, getProgressSummary, type ProgressRange } from '../../utils/progress';

// Calendar dates ("YYYY-MM-DD") read as local dates, so labels never shift by a day.
const fromCalendarDate = (calendarDate: string) => {
  const [year, month, day] = calendarDate.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const dayFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const shortFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const plural = (count: number, one: string, many: string) =>
  count + ' ' + (count === 1 ? one : many);

const ProgressPage = () => {
  const tasks = useAppSelector((state) => state.tasks.items);
  const projects = useAppSelector((state) => state.projects.items);
  const loading = useAppSelector((state) => state.tasks.loading);
  const loaded = useAppSelector((state) => state.tasks.loaded);
  const error = useAppSelector((state) => state.tasks.error);
  const now = useToday();
  const [range, setRange] = useState<ProgressRange>(7);
  const summary = useMemo(
    () => getProgressSummary(tasks, projects, range, now),
    [tasks, projects, range, now],
  );
  const ready = loaded && !error;
  const initialLoad = loading && tasks.length === 0;
  const daily = range === 7;
  const largest = Math.max(1, ...summary.buckets.map((bucket) => bucket.completed));
  const change = summary.completed - summary.previousCompleted;
  const rangeLabel = 'last ' + range + ' days';
  const onTimePercent = summary.withDueDate
    ? Math.round((summary.onTime / summary.withDueDate) * 100)
    : 0;
  const average = Math.round((summary.completed / range) * 10) / 10;

  let status = '';
  if (initialLoad) status = 'Loading your progress...';
  else if (ready)
    status =
      'Showing the ' +
      rangeLabel +
      ': ' +
      plural(summary.completed, 'task', 'tasks') +
      ' completed.';

  return (
    <VStack align="stretch" gap={{ base: 6, md: 8 }}>
      <Box>
        <Heading as="h1" size={{ base: '2xl', md: '3xl' }}>
          Progress
        </Heading>
        <Text color="fg.muted" mt={1.5}>
          Counted from when you marked tasks done. These figures are rule-based, not AI.
        </Text>
      </Box>

      <HStack gap={3} flexWrap="wrap" role="group" aria-label="Time range">
        {PROGRESS_RANGES.map((option) => (
          <Button
            key={option}
            size="sm"
            variant={range === option ? 'solid' : 'outline'}
            aria-pressed={range === option}
            onClick={() => setRange(option)}
          >
            Last {option} days
          </Button>
        ))}
      </HStack>

      <Text role="status" aria-live="polite" color="fg.muted" fontSize="sm" mt={-4}>
        {status}
      </Text>

      {error && (
        <Box borderWidth="1px" borderColor="border.error" bg="bg.error" borderRadius="md" p={3}>
          <Text color="fg.error">{error}</Text>
        </Box>
      )}

      {ready && (
        <>
          <SimpleGrid
            as="section"
            aria-label="Progress metrics"
            columns={{ base: 2, xl: 4 }}
            gap={4}
          >
            <MetricCard
              label="Completed"
              value={summary.completed}
              detail={
                change === 0
                  ? 'Same as the previous ' + range + ' days'
                  : Math.abs(change) +
                    (change > 0 ? ' more' : ' fewer') +
                    ' than the previous ' +
                    range +
                    ' days'
              }
              icon={LuCircleCheck}
              accent="accent.teal"
            />
            <MetricCard
              label="Created"
              value={summary.created}
              detail={'New tasks in the ' + rangeLabel}
              icon={LuCirclePlus}
              accent="accent.violet"
            />
            <MetricCard
              label="Finished on time"
              value={summary.onTime}
              detail={
                summary.withDueDate
                  ? onTimePercent +
                    '% of ' +
                    plural(summary.withDueDate, 'task', 'tasks') +
                    ' with a due date'
                  : 'No completed tasks had a due date'
              }
              icon={LuCalendarCheck}
              accent="accent.teal"
            />
            <MetricCard
              label="Average per day"
              value={average}
              detail={'Completed tasks across ' + range + ' days'}
              icon={LuGauge}
              accent="accent.orange"
            />
          </SimpleGrid>

          <SimpleGrid columns={{ base: 1, xl: 3 }} gap={6} alignItems="start">
            <Box
              as="section"
              aria-labelledby="completions-heading"
              bg="bg.panel"
              borderWidth="1px"
              borderRadius="lg"
              p={{ base: 4, md: 5 }}
              gridColumn={{ xl: 'span 2' }}
              minW="0"
            >
              <SectionHeader
                id="completions-heading"
                title={daily ? 'Completed each day' : 'Completed each week'}
              />
              <Table.Root size="sm" variant="line">
                <Table.Caption srOnly>
                  {(daily ? 'Tasks completed each day' : 'Tasks completed each week') +
                    ', ' +
                    rangeLabel +
                    ', oldest first'}
                </Table.Caption>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>{daily ? 'Day' : 'Week'}</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end" w="6rem">
                      Completed
                    </Table.ColumnHeader>
                    <Table.ColumnHeader w="45%">
                      <Box as="span" srOnly>
                        Chart
                      </Box>
                    </Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {summary.buckets.map((bucket) => (
                    <Table.Row key={bucket.start}>
                      <Table.Cell>
                        {daily
                          ? dayFormat.format(fromCalendarDate(bucket.start))
                          : shortFormat.format(fromCalendarDate(bucket.start)) +
                            ' to ' +
                            shortFormat.format(fromCalendarDate(bucket.end))}
                      </Table.Cell>
                      <Table.Cell textAlign="end" fontWeight="semibold">
                        {bucket.completed}
                      </Table.Cell>
                      <Table.Cell aria-hidden="true">
                        <Box bg="bg.muted" borderRadius="sm" h="2.5">
                          <Box
                            bg="accent.teal"
                            borderRadius="sm"
                            h="full"
                            w={(bucket.completed / largest) * 100 + '%'}
                          />
                        </Box>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
              {summary.unknownCompletion > 0 && (
                <Text color="fg.muted" fontSize="sm" mt={4}>
                  {plural(summary.unknownCompletion, 'done task was', 'done tasks were')} finished
                  before TaskForge recorded completion dates, so{' '}
                  {summary.unknownCompletion === 1 ? 'it is' : 'they are'} not counted here.
                </Text>
              )}
            </Box>

            <Box
              as="section"
              aria-labelledby="project-progress-heading"
              bg="bg.panel"
              borderWidth="1px"
              borderRadius="lg"
              p={{ base: 4, md: 5 }}
              minW="0"
            >
              <SectionHeader id="project-progress-heading" title="By project" />
              {summary.byProject.length ? (
                <Box as="ul" listStyleType="none" m={0} p={0}>
                  {summary.byProject.map((item) => (
                    <HStack
                      as="li"
                      key={item.projectId ?? 'none'}
                      justify="space-between"
                      gap={3}
                      py={2}
                      borderTopWidth="1px"
                      borderColor="border.muted"
                    >
                      <Text overflowWrap="anywhere">{item.name}</Text>
                      <Text color="fg.muted" whiteSpace="nowrap">
                        {plural(item.completed, 'completed', 'completed')}
                      </Text>
                    </HStack>
                  ))}
                </Box>
              ) : (
                <EmptyState
                  icon={<LuCircleCheck size={24} />}
                  title="Nothing completed yet"
                  description={'Tasks you finish in the ' + rangeLabel + ' appear here by project.'}
                />
              )}
            </Box>
          </SimpleGrid>
        </>
      )}
    </VStack>
  );
};

export default ProgressPage;
