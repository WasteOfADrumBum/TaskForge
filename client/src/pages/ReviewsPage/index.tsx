import { Button, Checkbox, Field, FieldGroup, Stack, Textarea } from '@onesmall/ui';
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
    <ul className="os-list-unstyled os-m-0" aria-label={label}>
      {tasks.slice(0, LOOK_BACK_LIMIT).map((task) => (
        <li key={getTaskId(task)} className="os-py-2 os-border-top">
          <p className="os-text-break os-m-0">{task.title}</p>
          {task.dueDate && task.status !== 'done' && (
            <p className="os-text-xs os-text-muted os-m-0">
              Due {formatCalendarDate(task.dueDate)}
            </p>
          )}
        </li>
      ))}
    </ul>
    {tasks.length > LOOK_BACK_LIMIT && (
      <p className="os-text-sm os-text-muted os-mt-2 os-mb-0">
        And {tasks.length - LOOK_BACK_LIMIT} more.
      </p>
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
  <section aria-labelledby={id} className="tf-panel os-p-4 md:os-p-5">
    <p className="os-text-muted os-text-sm os-font-medium os-m-0">
      Step {number} of {total}
    </p>
    <h3 id={id} className="tf-h3 os-mt-0 os-mb-3">
      {title}
    </h3>
    {children}
  </section>
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
      <p
        ref={resultRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="os-text-sm os-text-muted os-m-0"
      >
        {pending ? 'Loading your goals...' : (message ?? '')}
      </p>
      {failure && (
        <p role="alert" className="os-text-danger os-text-sm os-m-0">
          {failure}
        </p>
      )}
      {error && !pending ? (
        <Stack gap={2} align="start">
          <p className="os-text-danger os-m-0">{error}</p>
          <Button size="sm" variant="outline" onClick={reload}>
            Retry loading goals
          </Button>
        </Stack>
      ) : loaded && active.length ? (
        <ul className="os-list-unstyled os-m-0" aria-label="Active goals">
          {active.map((goal) => {
            const target = goalTargetText(goal, now);
            return (
              <li
                key={getGoalId(goal)}
                className="os-flex os-flex-wrap os-justify-between os-items-center os-gap-3 os-py-2 os-border-top"
              >
                <div className="os-min-w-0">
                  <p className="os-text-break os-m-0">{goal.title}</p>
                  {target && <p className="os-text-xs os-text-muted os-m-0">{target}</p>}
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={isBusy(getGoalId(goal))}
                  onClick={() => void achieve(goal)}
                  aria-label={'Mark achieved: ' + goal.title}
                >
                  Mark achieved
                </Button>
              </li>
            );
          })}
        </ul>
      ) : loaded ? (
        <p className="os-text-muted os-m-0">No active goals yet.</p>
      ) : null}
      <RouterLink to="/goals" className="os-text-sm os-mt-3 os-inline-block">
        Add or update goals
      </RouterLink>
    </>
  );
}

const SubList = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <div className="os-mt-3">
    <h4 id={id} className="os-text-sm os-font-semibold os-mt-0 os-mb-1">
      {title}
    </h4>
    {/* role="list": Safari drops list semantics from unstyled lists. */}
    <ul role="list" className="os-list-unstyled os-m-0" aria-labelledby={id}>
      {children}
    </ul>
  </div>
);

const SubItem = ({ children }: { children: ReactNode }) => (
  <li className="os-py-2 os-border-top">{children}</li>
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
      <p
        ref={statusRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="os-text-sm os-text-muted os-m-0"
      >
        {status}
      </p>
      {error && !pending ? (
        <Stack gap={2} align="start">
          <p role="alert" className="os-text-danger os-m-0">
            {error}
          </p>
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
        </Stack>
      ) : !loaded || !tasksReady ? null : skills.items.length === 0 && jobs.items.length === 0 ? (
        <p className="os-text-muted os-m-0">
          Add your skills and the jobs you want in Career to track your growth here.
        </p>
      ) : (
        <>
          {!changed && (
            <p className="os-text-muted os-m-0">
              No skills added or updated and no learning tasks finished this week.
            </p>
          )}
          {growth.added.length > 0 && (
            <SubList id="growth-added" title={'Skills added this week: ' + growth.added.length}>
              {growth.added.map((skill) => (
                <SubItem key={getRecordId(skill)}>
                  <p className="os-text-break os-m-0">
                    {skill.name}, {skillLevelLabel[skill.level].toLowerCase()}
                  </p>
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
                  <p className="os-text-break os-m-0">
                    {skill.name}, {skillLevelLabel[skill.level].toLowerCase()}
                  </p>
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
                  <p className="os-text-break os-m-0">{task.title}</p>
                </SubItem>
              ))}
            </SubList>
          )}
          {growth.topGaps.length > 0 ? (
            <SubList id="growth-gaps" title="Skills your open saved jobs need most">
              {growth.topGaps.map((gap) => (
                <SubItem key={gap.skill}>
                  <p className="os-text-break os-m-0">
                    {gap.skill}: needed by {plural(gap.jobs, 'job', 'jobs')}
                  </p>
                </SubItem>
              ))}
            </SubList>
          ) : growth.hasOpenJobs ? (
            <p className="os-text-muted os-mt-3 os-mb-0">Your skills cover every open saved job.</p>
          ) : null}
        </>
      )}
      <RouterLink to="/career" className="os-text-sm os-mt-3 os-inline-block">
        Update skills and jobs in Career
      </RouterLink>
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
    <Stack as="form" gap={6} onSubmit={onSubmit} aria-labelledby={ids('heading')}>
      <div>
        <h2 id={ids('heading')} className="tf-h2 os-m-0">
          {kindLabel[kind]}
        </h2>
        <p className="os-text-muted os-m-0">{periodLabel}</p>
        <p role="status" aria-live="polite" className="os-text-sm os-text-muted os-mt-1 os-mb-0">
          {status}
        </p>
      </div>

      {loadError && !read.pending && (
        <Stack gap={2} align="start">
          <p className="os-text-danger os-m-0">{loadError}</p>
          <Button size="sm" variant="outline" onClick={() => setRefreshKey((key) => key + 1)}>
            Retry loading review
          </Button>
        </Stack>
      )}

      {loaded && (
        <>
          <Step id={ids('look-back')} number={1} total={totalSteps} title="Look back">
            {tasksReady && (
              <p className="os-font-medium os-mt-0 os-mb-2">
                {text.done}: {data.completed.length}
              </p>
            )}
            {!tasksReady ? (
              <p className="os-text-muted os-m-0">{tasksPending}</p>
            ) : data.completed.length ? (
              <TaskList tasks={data.completed} label={text.done} />
            ) : (
              <p className="os-text-muted os-m-0">{text.none}</p>
            )}
          </Step>

          <Step id={ids('attention')} number={2} total={totalSteps} title="Needs attention">
            {tasksReady && (
              <p className="os-font-medium os-mt-0 os-mb-2">
                {text.attention}: {data.attention.length}
              </p>
            )}
            {!tasksReady ? (
              <p className="os-text-muted os-m-0">{tasksPending}</p>
            ) : data.attention.length ? (
              <TaskList tasks={data.attention} label={text.attention} />
            ) : (
              <p className="os-text-muted os-m-0">Nothing is overdue or coming due. Nice.</p>
            )}
            <RouterLink to="/work" className="os-text-sm os-mt-3 os-inline-block">
              Reschedule or update tasks in Work
            </RouterLink>
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
              <p className="os-text-muted os-m-0">{tasksPending}</p>
            ) : data.candidates.length ? (
              <FieldGroup
                legend={text.focus}
                description={
                  <span aria-live="polite">
                    {liveFocus.length} of {max} chosen
                  </span>
                }
              >
                {data.candidates.map((task) => {
                  const id = getTaskId(task);
                  const checked = liveFocus.includes(id);
                  return (
                    <Checkbox
                      key={id}
                      checked={checked}
                      disabled={!checked && liveFocus.length >= max}
                      onChange={(event) => toggle(id, event.target.checked)}
                      label={
                        <span className="os-text-break">
                          {task.title}
                          {task.dueDate && (
                            <span className="os-block os-text-xs os-text-muted">
                              Due {formatCalendarDate(task.dueDate)}
                            </span>
                          )}
                        </span>
                      }
                    />
                  );
                })}
              </FieldGroup>
            ) : (
              <p className="os-text-muted os-m-0">No open tasks to choose from.</p>
            )}
          </Step>

          <Step id={ids('reflect')} number={totalSteps} total={totalSteps} title="Reflect">
            <Field
              label={text.reflect}
              hint={
                plural(REVIEW_REFLECTION_MAX - reflection.length, 'character', 'characters') +
                ' left'
              }
            >
              <Textarea
                value={reflection}
                onChange={(event) => {
                  setSaveError(null);
                  setReflection(event.target.value);
                }}
                rows={4}
                maxLength={REVIEW_REFLECTION_MAX}
              />
            </Field>
          </Step>

          {saveError && (
            <div role="alert" className="tf-callout-danger os-p-3">
              <p className="os-text-danger os-m-0">{saveError}</p>
            </div>
          )}
          <div className="os-flex">
            <Button
              type="submit"
              color="primary"
              loading={write.pending}
              leftIcon={<LuSave focusable="false" />}
            >
              Save {kindLabel[kind].toLowerCase()}
            </Button>
          </div>
        </>
      )}
    </Stack>
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
    <Stack gap={{ base: 6, md: 8 }}>
      <div>
        <h1 className="tf-h1 os-m-0">Reviews</h1>
        <p className="os-text-muted os-mt-2 os-mb-0">
          A few minutes to look back, see what needs attention, and pick your focus. The lists are
          rule-based, not AI.
        </p>
      </div>
      <div className="os-flex os-flex-wrap os-gap-3" role="group" aria-label="Review type">
        {REVIEW_KINDS.map((option) => (
          <Button
            key={option}
            size="sm"
            variant={kind === option ? 'solid' : 'outline'}
            pressed={kind === option}
            onClick={() => setKind(option)}
          >
            {kindLabel[option]}
          </Button>
        ))}
      </div>
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
    </Stack>
  );
};

export default ReviewsPage;
