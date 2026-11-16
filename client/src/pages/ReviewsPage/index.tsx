import {
  Box,
  Button,
  Checkbox,
  Field,
  Fieldset,
  Heading,
  HStack,
  Link,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { LuSave } from 'react-icons/lu';
import { Link as RouterLink } from 'react-router-dom';
import { getJobs, getSkills } from '../../api/career';
import { getReviews, saveReview } from '../../api/reviews';
import { getTasks } from '../../api/tasks';
import { isCurrentSession } from '../../api/authenticatedFetch';
import { useDelayedRequest } from '../../hooks/useDelayedRequest';
import { useGoals } from '../../hooks/useGoals';
import { useOwnedList } from '../../hooks/useOwnedList';
import { useToday } from '../../hooks/useToday';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import {
  REVIEW_FOCUS_MAX,
  REVIEW_KINDS,
  REVIEW_REFLECTION_MAX,
  type ReviewKind,
} from '../../types/review';
import { getRecordId, skillLevelLabel, type SavedJob, type Skill } from '../../types/career';
import { getGoalId, type Goal } from '../../types/goal';
import { getTaskId, type Task } from '../../types/task';
import { formatCalendarDate } from '../../utils/dates';
import { goalTargetText } from '../../utils/goals';
import { getReviewData } from '../../utils/reviews';
import { getSkillGrowth } from '../../utils/skillGrowth';
import { SessionExpiredError } from '../../utils/session';

const LOOK_BACK_LIMIT = 10;
const kindLabel: Record<ReviewKind, string> = { daily: 'Daily review', weekly: 'Weekly review' };
const copy: Record<
  ReviewKind,
  { done: string; attention: string; focus: string; none: string; reflect: string }
> = {
  daily: {
    done: 'Completed today',
    attention: 'Overdue or due today',
    focus: 'Choose up to 3 tasks to focus on tomorrow',
    none: 'Nothing completed yet today.',
    reflect: 'What went well today, and what will you change tomorrow?',
  },
  weekly: {
    done: 'Completed this week',
    attention: 'Overdue or due by Sunday',
    focus: 'Choose up to 5 tasks to focus on next week',
    none: 'Nothing completed yet this week.',
    reflect: 'What went well this week, and what will you change next week?',
  },
};
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const plural = (count: number, one: string, many: string) =>
  count + ' ' + (count === 1 ? one : many);

const TaskList = ({ tasks, label }: { tasks: Task[]; label: string }) => (
  <>
    <Box as="ul" listStyleType="none" m={0} p={0} aria-label={label}>
      {tasks.slice(0, LOOK_BACK_LIMIT).map((task) => (
        <Box as="li" key={getTaskId(task)} py={1.5} borderTopWidth="1px" borderColor="border.muted">
          <Text overflowWrap="anywhere">{task.title}</Text>
          {task.dueDate && task.status !== 'done' && (
            <Text fontSize="xs" color="fg.muted">
              Due {formatCalendarDate(task.dueDate)}
            </Text>
          )}
        </Box>
      ))}
    </Box>
    {tasks.length > LOOK_BACK_LIMIT && (
      <Text fontSize="sm" color="fg.muted" mt={2}>
        And {tasks.length - LOOK_BACK_LIMIT} more.
      </Text>
    )}
  </>
);

const Step = ({
  id,
  number,
  total,
  title,
  children,
}: {
  id: string;
  number: number;
  total: number;
  title: string;
  children: ReactNode;
}) => (
  <Box
    as="section"
    aria-labelledby={id}
    bg="bg.panel"
    borderWidth="1px"
    borderRadius="lg"
    p={{ base: 4, md: 5 }}
  >
    <Text color="fg.muted" fontSize="sm" fontWeight="medium">
      Step {number} of {total}
    </Text>
    <Heading as="h3" id={id} size="md" mb={3}>
      {title}
    </Heading>
    {children}
  </Box>
);

// Weekly goal check-in: active goals with their targets, and a quick way to mark one achieved.
function GoalCheckIn({ now }: { now: Date }) {
  const { goals, loaded, error, pending, isBusy, reload, update } = useGoals();
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  // The pressed button leaves the list, so focus moves to the result line.
  const resultRef = useRef<HTMLParagraphElement>(null);
  const active = goals.filter((goal) => goal.status === 'active');
  const achieve = async (goal: Goal) => {
    setMessage(null);
    setFailure(null);
    const error = await update(getGoalId(goal), { status: 'achieved' });
    if (error) setFailure(error);
    else {
      setMessage('Marked achieved: ' + goal.title + '.');
      resultRef.current?.focus();
    }
  };
  return (
    <>
      <Text
        ref={resultRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        fontSize="sm"
        color="fg.muted"
        _focusVisible={{ outline: '2px solid', outlineColor: 'accent.teal' }}
      >
        {pending ? 'Loading your goals...' : (message ?? '')}
      </Text>
      {failure && (
        <Text role="alert" color="fg.error" fontSize="sm">
          {failure}
        </Text>
      )}
      {error && !pending ? (
        <VStack align="start" gap={2}>
          <Text color="fg.error">{error}</Text>
          <Button size="sm" variant="outline" onClick={reload}>
            Retry loading goals
          </Button>
        </VStack>
      ) : loaded && active.length ? (
        <Box as="ul" listStyleType="none" m={0} p={0} aria-label="Active goals">
          {active.map((goal) => {
            const target = goalTargetText(goal, now);
            return (
              <HStack
                as="li"
                key={getGoalId(goal)}
                justify="space-between"
                gap={3}
                py={2}
                borderTopWidth="1px"
                borderColor="border.muted"
                flexWrap="wrap"
              >
                <Box minW="0">
                  <Text overflowWrap="anywhere">{goal.title}</Text>
                  {target && (
                    <Text fontSize="xs" color="fg.muted">
                      {target}
                    </Text>
                  )}
                </Box>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={isBusy(getGoalId(goal))}
                  onClick={() => void achieve(goal)}
                  aria-label={'Mark achieved: ' + goal.title}
                >
                  Mark achieved
                </Button>
              </HStack>
            );
          })}
        </Box>
      ) : loaded ? (
        <Text color="fg.muted">No active goals yet.</Text>
      ) : null}
      <Link asChild fontSize="sm" color="accent.teal" mt={3} display="inline-block">
        <RouterLink to="/goals">Add or update goals</RouterLink>
      </Link>
    </>
  );
}

const SubList = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <Box mt={3}>
    <Heading as="h4" id={id} size="sm" mb={1}>
      {title}
    </Heading>
    <Box as="ul" role="list" listStyleType="none" m={0} p={0} aria-labelledby={id}>
      {children}
    </Box>
  </Box>
);

const SubItem = ({ children }: { children: ReactNode }) => (
  <Box as="li" py={1.5} borderTopWidth="1px" borderColor="border.muted">
    {children}
  </Box>
);

// Weekly skill growth: skills added or levelled this week, learning tasks finished, and the
// skills open saved jobs need most. Rule-based, from the Career page's skills and saved jobs.
function SkillGrowthStep({
  now,
  tasks,
  tasksReady,
  tasksPending,
}: {
  now: Date;
  tasks: Task[];
  tasksReady: boolean;
  tasksPending: string;
}) {
  const skills = useOwnedList<Skill>(getSkills, 'Unable to load skills');
  const jobs = useOwnedList<SavedJob>(getJobs, 'Unable to load saved jobs');
  const loaded = skills.loaded && jobs.loaded;
  const error = skills.error ?? jobs.error;
  const pending = skills.pending || jobs.pending;
  const growth = useMemo(
    () => getSkillGrowth(skills.items, jobs.items, tasks, now),
    [skills.items, jobs.items, tasks, now],
  );
  const changed = growth.added.length + growth.updated.length + growth.learned.length > 0;

  // The Retry button leaves the page while loading, so focus moves to the status line.
  const statusRef = useRef<HTMLParagraphElement>(null);
  let status = '';
  if (pending) status = 'Loading your skills and saved jobs...';
  else if (error) status = 'Your skills or saved jobs could not be loaded.';
  else if (loaded && !tasksReady) status = tasksPending;

  return (
    <>
      <Text
        ref={statusRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        fontSize="sm"
        color="fg.muted"
        _focusVisible={{ outline: '2px solid', outlineColor: 'accent.teal' }}
      >
        {status}
      </Text>
      {error && !pending ? (
        <VStack align="start" gap={2}>
          <Text role="alert" color="fg.error">
            {error}
          </Text>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (skills.error) skills.reload();
              if (jobs.error) jobs.reload();
              statusRef.current?.focus();
            }}
          >
            Retry loading skills
          </Button>
        </VStack>
      ) : !loaded || !tasksReady ? null : skills.items.length === 0 && jobs.items.length === 0 ? (
        <Text color="fg.muted">
          Add your skills and the jobs you want in Career to track your growth here.
        </Text>
      ) : (
        <>
          {!changed && (
            <Text color="fg.muted">
              No skills added or updated and no learning tasks finished this week.
            </Text>
          )}
          {growth.added.length > 0 && (
            <SubList id="growth-added" title={'Skills added this week: ' + growth.added.length}>
              {growth.added.map((skill) => (
                <SubItem key={getRecordId(skill)}>
                  <Text overflowWrap="anywhere">
                    {skill.name}, {skillLevelLabel[skill.level].toLowerCase()}
                  </Text>
                </SubItem>
              ))}
            </SubList>
          )}
          {growth.updated.length > 0 && (
            <SubList
              id="growth-updated"
              title={'Skills updated this week: ' + growth.updated.length}
            >
              {growth.updated.map((skill) => (
                <SubItem key={getRecordId(skill)}>
                  <Text overflowWrap="anywhere">
                    {skill.name}, {skillLevelLabel[skill.level].toLowerCase()}
                  </Text>
                </SubItem>
              ))}
            </SubList>
          )}
          {growth.learned.length > 0 && (
            <SubList
              id="growth-learned"
              title={'Learning tasks finished this week: ' + growth.learned.length}
            >
              {growth.learned.map((task) => (
                <SubItem key={getTaskId(task)}>
                  <Text overflowWrap="anywhere">{task.title}</Text>
                </SubItem>
              ))}
            </SubList>
          )}
          {growth.topGaps.length > 0 ? (
            <SubList id="growth-gaps" title="Skills your open saved jobs need most">
              {growth.topGaps.map((gap) => (
                <SubItem key={gap.skill}>
                  <Text overflowWrap="anywhere">
                    {gap.skill}: needed by {plural(gap.jobs, 'job', 'jobs')}
                  </Text>
                </SubItem>
              ))}
            </SubList>
          ) : growth.hasOpenJobs ? (
            <Text color="fg.muted" mt={3}>
              Your skills cover every open saved job.
            </Text>
          ) : null}
        </>
      )}
      <Link asChild fontSize="sm" color="accent.teal" mt={3} display="inline-block">
        <RouterLink to="/career">Update skills and jobs in Career</RouterLink>
      </Link>
    </>
  );
}

function ReviewForm({
  kind,
  token,
  sessionVersion,
  now,
}: {
  kind: ReviewKind;
  token: string;
  sessionVersion: number;
  now: Date;
}) {
  const tasks = useAppSelector((state) => state.tasks.items);
  const tasksLoaded = useAppSelector((state) => state.tasks.loaded);
  const tasksError = useAppSelector((state) => state.tasks.error);
  const tasksReady = tasksLoaded && !tasksError;
  const [focus, setFocus] = useState<string[]>([]);
  // Focus saved earlier stays listed even when it falls outside the usual candidate cap.
  const [savedFocus, setSavedFocus] = useState<string[]>([]);
  const [reflection, setReflection] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const read = useDelayedRequest();
  const write = useDelayedRequest();
  const { begin } = read;
  const data = useMemo(
    () => getReviewData(tasks, kind, now, savedFocus),
    [tasks, kind, now, savedFocus],
  );
  const { period } = data;
  const max = REVIEW_FOCUS_MAX[kind];
  const text = copy[kind];
  const ids = (prefix: string) => kind + '-' + prefix;
  // The weekly review adds a goal check-in and a skill-growth step.
  const totalSteps = kind === 'weekly' ? 6 : 4;

  useEffect(() => {
    if (!isCurrentSession(token, sessionVersion)) return;
    const request = begin();
    if (!request) return;
    void getReviews(token, kind, 1, request.signal)
      .then(([latest]) => {
        if (!request.isCurrent() || !isCurrentSession(token, sessionVersion)) return;
        if (latest && latest.period === period) {
          setFocus(latest.focusTasks);
          setSavedFocus(latest.focusTasks);
          setReflection(latest.reflection);
          setSavedAt(latest.updatedAt ?? null);
        }
        setLoadError(null);
        setLoaded(true);
      })
      .catch((failure: unknown) => {
        if (
          !request.isCurrent() ||
          !isCurrentSession(token, sessionVersion) ||
          failure instanceof SessionExpiredError
        )
          return;
        setLoadError(failure instanceof Error ? failure.message : 'Unable to load your review');
      })
      .finally(request.finish);
    return request.cancel;
    // The period is part of the key that mounts this form, so it never changes in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sessionVersion, kind, refreshKey, begin]);

  // Focus ids whose task is still loaded; a deleted task drops out instead of blocking a save.
  const knownIds = new Set(tasks.map(getTaskId));
  const liveFocus = tasksLoaded ? focus.filter((id) => knownIds.has(id)) : focus;

  const toggle = (taskId: string, checked: boolean) => {
    setSaveError(null);
    if (!checked) setFocus(liveFocus.filter((id) => id !== taskId));
    else if (!liveFocus.includes(taskId) && liveFocus.length < max)
      setFocus([...liveFocus, taskId]);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!isCurrentSession(token, sessionVersion)) return;
    const request = write.begin();
    if (!request) return;
    setSaveError(null);
    void saveReview(token, kind, period, { reflection, focusTasks: liveFocus }, request.signal)
      .then((review) => {
        if (!request.isCurrent() || !isCurrentSession(token, sessionVersion)) return;
        // Keep what is on screen: edits made while saving must not be overwritten.
        setSavedFocus(review.focusTasks);
        setSavedAt(review.updatedAt ?? new Date().toISOString());
      })
      .catch(async (failure: unknown) => {
        if (
          !request.isCurrent() ||
          !isCurrentSession(token, sessionVersion) ||
          failure instanceof SessionExpiredError
        )
          return;
        const message = failure instanceof Error ? failure.message : 'Unable to save review';
        if (message !== 'Task not found') return setSaveError(message);
        // A focus task was deleted elsewhere after this page loaded. Drop it and ask again.
        try {
          const current = new Set((await getTasks(token, request.signal)).map(getTaskId));
          if (!request.isCurrent() || !isCurrentSession(token, sessionVersion)) return;
          setFocus((chosen) => chosen.filter((id) => current.has(id)));
          setSaveError(
            'A focus task was deleted elsewhere, so it was removed. Check your focus and save again.',
          );
        } catch {
          if (request.isCurrent()) setSaveError(message);
        }
      })
      .finally(request.finish);
  };

  let status = '';
  if (read.pending)
    status = read.waiting ? 'Still loading your review...' : 'Loading your review...';
  else if (write.pending) status = write.waiting ? 'Still saving...' : 'Saving your review...';
  else if (loadError) status = 'Your review could not be loaded.';
  else if (saveError) status = 'Your review was not saved.';
  else if (savedAt) status = 'Saved at ' + timeFormat.format(new Date(savedAt)) + '.';

  const tasksPending = tasksError
    ? 'Your tasks could not be loaded, so this step is empty for now.'
    : 'Waiting for your tasks to load...';

  const periodLabel =
    kind === 'daily' ? formatCalendarDate(period) : 'Week of ' + formatCalendarDate(period);

  return (
    <VStack as="form" align="stretch" gap={6} onSubmit={onSubmit} aria-labelledby={ids('heading')}>
      <Box>
        <Heading as="h2" id={ids('heading')} size="lg">
          {kindLabel[kind]}
        </Heading>
        <Text color="fg.muted">{periodLabel}</Text>
        <Text role="status" aria-live="polite" fontSize="sm" color="fg.muted" mt={1}>
          {status}
        </Text>
      </Box>

      {loadError && !read.pending && (
        <VStack align="start" gap={2}>
          <Text color="fg.error">{loadError}</Text>
          <Button size="sm" variant="outline" onClick={() => setRefreshKey((key) => key + 1)}>
            Retry loading review
          </Button>
        </VStack>
      )}

      {loaded && (
        <>
          <Step id={ids('look-back')} number={1} total={totalSteps} title="Look back">
            {tasksReady && (
              <Text fontWeight="medium" mb={2}>
                {text.done}: {data.completed.length}
              </Text>
            )}
            {!tasksReady ? (
              <Text color="fg.muted">{tasksPending}</Text>
            ) : data.completed.length ? (
              <TaskList tasks={data.completed} label={text.done} />
            ) : (
              <Text color="fg.muted">{text.none}</Text>
            )}
          </Step>

          <Step id={ids('attention')} number={2} total={totalSteps} title="Needs attention">
            {tasksReady && (
              <Text fontWeight="medium" mb={2}>
                {text.attention}: {data.attention.length}
              </Text>
            )}
            {!tasksReady ? (
              <Text color="fg.muted">{tasksPending}</Text>
            ) : data.attention.length ? (
              <TaskList tasks={data.attention} label={text.attention} />
            ) : (
              <Text color="fg.muted">Nothing is overdue or coming due. Nice.</Text>
            )}
            <Link asChild fontSize="sm" color="accent.teal" mt={3} display="inline-block">
              <RouterLink to="/work">Reschedule or update tasks in Work</RouterLink>
            </Link>
          </Step>

          {kind === 'weekly' && (
            <Step id={ids('goals')} number={3} total={totalSteps} title="Check in on your goals">
              <GoalCheckIn now={now} />
            </Step>
          )}

          {kind === 'weekly' && (
            <Step id={ids('skills')} number={4} total={totalSteps} title="Review your skill growth">
              <SkillGrowthStep
                now={now}
                tasks={tasks}
                tasksReady={tasksReady}
                tasksPending={tasksPending}
              />
            </Step>
          )}

          <Step
            id={ids('focus')}
            number={totalSteps - 1}
            total={totalSteps}
            title="Choose your focus"
          >
            {!tasksReady ? (
              <Text color="fg.muted">{tasksPending}</Text>
            ) : data.candidates.length ? (
              <Fieldset.Root>
                <Fieldset.Legend fontSize="sm" fontWeight="medium">
                  {text.focus}
                </Fieldset.Legend>
                <Fieldset.HelperText fontSize="xs" aria-live="polite">
                  {liveFocus.length} of {max} chosen
                </Fieldset.HelperText>
                <Fieldset.Content>
                  <VStack align="stretch" gap={2.5}>
                    {data.candidates.map((task) => {
                      const id = getTaskId(task);
                      const checked = liveFocus.includes(id);
                      return (
                        <Checkbox.Root
                          key={id}
                          checked={checked}
                          disabled={!checked && liveFocus.length >= max}
                          onCheckedChange={(details) => toggle(id, details.checked === true)}
                          alignItems="flex-start"
                          colorPalette="teal"
                        >
                          <Checkbox.HiddenInput />
                          <Checkbox.Control mt={0.5} />
                          <Checkbox.Label overflowWrap="anywhere">
                            {task.title}
                            {task.dueDate && (
                              <Text as="span" display="block" fontSize="xs" color="fg.muted">
                                Due {formatCalendarDate(task.dueDate)}
                              </Text>
                            )}
                          </Checkbox.Label>
                        </Checkbox.Root>
                      );
                    })}
                  </VStack>
                </Fieldset.Content>
              </Fieldset.Root>
            ) : (
              <Text color="fg.muted">No open tasks to choose from.</Text>
            )}
          </Step>

          <Step id={ids('reflect')} number={totalSteps} total={totalSteps} title="Reflect">
            <Field.Root>
              <Field.Label>{text.reflect}</Field.Label>
              <Textarea
                value={reflection}
                onChange={(event) => {
                  setSaveError(null);
                  setReflection(event.target.value);
                }}
                rows={4}
                maxLength={REVIEW_REFLECTION_MAX}
              />
              <Field.HelperText>
                {plural(REVIEW_REFLECTION_MAX - reflection.length, 'character', 'characters')} left
              </Field.HelperText>
            </Field.Root>
          </Step>

          {saveError && (
            <Box
              role="alert"
              borderWidth="1px"
              borderColor="border.error"
              bg="bg.error"
              borderRadius="md"
              p={3}
            >
              <Text color="fg.error">{saveError}</Text>
            </Box>
          )}
          <HStack>
            <Button type="submit" colorPalette="teal" loading={write.pending}>
              <LuSave aria-hidden="true" focusable="false" />
              Save {kindLabel[kind].toLowerCase()}
            </Button>
          </HStack>
        </>
      )}
    </VStack>
  );
}

// Guided daily and weekly reviews. Everything shown is rule-based; nothing is AI-generated.
const ReviewsPage = () => {
  const token = useAppSelector((state) => state.auth.token);
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  const now = useToday();
  const [kind, setKind] = useState<ReviewKind>('daily');
  const period = getReviewData([], kind, now).period;

  return (
    <VStack align="stretch" gap={{ base: 6, md: 8 }}>
      <Box>
        <Heading as="h1" size={{ base: '2xl', md: '3xl' }}>
          Reviews
        </Heading>
        <Text color="fg.muted" mt={1.5}>
          A few minutes to look back, see what needs attention, and pick your focus. The lists are
          rule-based, not AI.
        </Text>
      </Box>
      <HStack gap={3} flexWrap="wrap" role="group" aria-label="Review type">
        {REVIEW_KINDS.map((option) => (
          <Button
            key={option}
            size="sm"
            variant={kind === option ? 'solid' : 'outline'}
            aria-pressed={kind === option}
            onClick={() => setKind(option)}
          >
            {kindLabel[option]}
          </Button>
        ))}
      </HStack>
      {token && (
        // A new kind, period (after midnight or on Monday) or session starts a fresh form.
        <ReviewForm
          key={[kind, period, token, sessionVersion].join(':')}
          kind={kind}
          token={token}
          sessionVersion={sessionVersion}
          now={now}
        />
      )}
    </VStack>
  );
};

export default ReviewsPage;
