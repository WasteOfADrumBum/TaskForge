import { Button, Grid, Stack, Table } from '@onesmall/ui';
import { useMemo, useState } from 'react';
import { LuCalendarCheck, LuCircleCheck, LuCirclePlus, LuGauge } from 'react-icons/lu';
import EmptyState from '../../components/common/EmptyState';
import MetricCard from '../../components/common/MetricCard';
import SectionHeader from '../../components/common/SectionHeader';
import { useToday } from '../../hooks/useToday';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import { PROGRESS_RANGES, getProgressSummary, type ProgressRange } from '../../utils/progress';
import styles from './Progress.module.css';

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
    <Stack gap={{ base: 6, md: 8 }}>
      <div>
        <h1 className="tf-h1 os-m-0">Progress</h1>
        <p className="os-text-muted os-mt-2 os-mb-0">
          Counted from when you marked tasks done. These figures are rule-based, not AI.
        </p>
      </div>

      <div className="os-flex os-flex-wrap os-gap-3" role="group" aria-label="Time range">
        {PROGRESS_RANGES.map((option) => (
          <Button
            key={option}
            size="sm"
            variant={range === option ? 'solid' : 'outline'}
            pressed={range === option}
            onClick={() => setRange(option)}
          >
            Last {option} days
          </Button>
        ))}
      </div>

      <p role="status" aria-live="polite" className={`os-text-muted os-text-sm ${styles.status}`}>
        {status}
      </p>

      {error && (
        <div className="tf-callout-danger os-p-3">
          <p className="os-text-danger os-m-0">{error}</p>
        </div>
      )}

      {ready && (
        <>
          <Grid as="section" aria-label="Progress metrics" columns={{ base: 2, xl: 4 }} gap={4}>
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
              accent="primary"
            />
            <MetricCard
              label="Created"
              value={summary.created}
              detail={'New tasks in the ' + rangeLabel}
              icon={LuCirclePlus}
              accent="accent"
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
              accent="primary"
            />
            <MetricCard
              label="Average per day"
              value={average}
              detail={'Completed tasks across ' + range + ' days'}
              icon={LuGauge}
              accent="secondary"
            />
          </Grid>

          <Grid columns={{ base: 1, xl: 3 }} gap={6} className="os-items-start">
            <section
              aria-labelledby="completions-heading"
              className="tf-panel os-p-4 md:os-p-5 xl:os-col-span-2 os-min-w-0"
            >
              <SectionHeader
                id="completions-heading"
                title={daily ? 'Completed each day' : 'Completed each week'}
              />
              <Table size="sm">
                <caption className="os-sr-only">
                  {(daily ? 'Tasks completed each day' : 'Tasks completed each week') +
                    ', ' +
                    rangeLabel +
                    ', oldest first'}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{daily ? 'Day' : 'Week'}</th>
                    <th scope="col" className={`os-text-end ${styles.countColumn}`}>
                      Completed
                    </th>
                    {/* Decorative bars: the whole column is hidden, so the count column carries the value. */}
                    <th className={styles.barColumn} aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {summary.buckets.map((bucket) => (
                    <tr key={bucket.start}>
                      <td>
                        {daily
                          ? dayFormat.format(fromCalendarDate(bucket.start))
                          : shortFormat.format(fromCalendarDate(bucket.start)) +
                            ' to ' +
                            shortFormat.format(fromCalendarDate(bucket.end))}
                      </td>
                      <td className="os-text-end os-font-semibold">{bucket.completed}</td>
                      <td aria-hidden="true">
                        <div className={styles.barTrack}>
                          <div
                            className={styles.barFill}
                            style={{ width: (bucket.completed / largest) * 100 + '%' }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {summary.unknownCompletion > 0 && (
                <p className="os-text-muted os-text-sm os-mt-4 os-mb-0">
                  {plural(summary.unknownCompletion, 'done task was', 'done tasks were')} finished
                  before TaskForge recorded completion dates, so{' '}
                  {summary.unknownCompletion === 1 ? 'it is' : 'they are'} not counted here.
                </p>
              )}
            </section>

            <section
              aria-labelledby="project-progress-heading"
              className="tf-panel os-p-4 md:os-p-5 os-min-w-0"
            >
              <SectionHeader id="project-progress-heading" title="By project" />
              {summary.byProject.length ? (
                <ul className="os-list-unstyled os-m-0">
                  {summary.byProject.map((item) => (
                    <li
                      key={item.projectId ?? 'none'}
                      className="os-flex os-justify-between os-items-center os-gap-3 os-py-2 os-border-top"
                    >
                      <span className="os-text-break">{item.name}</span>
                      <span className="os-text-muted os-text-nowrap">
                        {item.completed} completed
                      </span>
                    </li>
                  ))}
                  {summary.projectGroups > summary.byProject.length && (
                    <li className="os-text-muted os-text-sm os-pt-2">
                      Showing the top {summary.byProject.length} of {summary.projectGroups}.
                    </li>
                  )}
                </ul>
              ) : (
                <EmptyState
                  icon={<LuCircleCheck size={24} />}
                  title="Nothing completed yet"
                  description={'Tasks you finish in the ' + rangeLabel + ' appear here by project.'}
                />
              )}
            </section>
          </Grid>
        </>
      )}
    </Stack>
  );
};

export default ProgressPage;
