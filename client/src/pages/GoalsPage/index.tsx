import { Badge, Button, Field, Input, Select, Stack, Textarea } from '@onesmall/ui';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LuPlus } from 'react-icons/lu';
import { useGoals } from '../../hooks/useGoals';
import { useToday } from '../../hooks/useToday';
import {
  GOAL_AREAS,
  GOAL_DESCRIPTION_MAX,
  GOAL_STATUSES,
  GOAL_TITLE_MAX,
  getGoalId,
  goalAreaLabel,
  goalStatusLabel,
  type Goal,
  type GoalArea,
  type GoalStatus,
} from '../../types/goal';
import { goalTargetText } from '../../utils/goals';
import styles from './Goals.module.css';

const sectionTitle: Record<GoalStatus, string> = {
  active: 'Active goals',
  achieved: 'Achieved',
  dropped: 'Dropped',
};

const GoalRow = ({
  goal,
  now,
  busy,
  onStatus,
  onArea,
  onDelete,
}: {
  goal: Goal;
  now: Date;
  busy: boolean;
  onStatus: (status: GoalStatus) => void;
  onArea: (area: GoalArea) => void;
  onDelete: () => void;
}) => {
  const [confirming, setConfirming] = useState(false);
  // Keep keyboard focus on the delete controls as they swap (WCAG 2.4.3).
  const confirmRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const swapped = useRef(false);
  useEffect(() => {
    if (!swapped.current) return;
    (confirming ? confirmRef : deleteRef).current?.focus();
  }, [confirming]);
  const toggleConfirm = (next: boolean) => {
    swapped.current = true;
    setConfirming(next);
  };
  const target = goalTargetText(goal, now);
  const area = goal.area && goal.area !== 'general' ? goalAreaLabel[goal.area] + ' goal' : null;
  return (
    <li className="os-py-3 os-border-top">
      <p className="os-font-medium os-text-break os-m-0">{goal.title}</p>
      {goal.description && (
        <p className={`os-text-sm os-text-muted os-text-break os-m-0 ${styles.preWrap}`}>
          {goal.description}
        </p>
      )}
      {(area || target) && (
        <p className="os-text-sm os-text-muted os-m-0">
          {[area, target].filter(Boolean).join(' · ')}
        </p>
      )}
      <div className="os-flex os-flex-wrap os-items-center os-gap-2 os-mt-2">
        <Select
          size="xs"
          value={goal.area ?? 'general'}
          onChange={(event) => onArea(event.target.value as GoalArea)}
          aria-label={'Area for ' + goal.title}
        >
          {GOAL_AREAS.map((option) => (
            <option key={option} value={option}>
              {goalAreaLabel[option]}
            </option>
          ))}
        </Select>
        {goal.status === 'active' ? (
          <>
            <Button
              size="xs"
              variant="outline"
              disabled={busy}
              onClick={() => onStatus('achieved')}
              aria-label={'Mark achieved: ' + goal.title}
            >
              Mark achieved
            </Button>
            <Button
              size="xs"
              variant="ghost"
              disabled={busy}
              onClick={() => onStatus('dropped')}
              aria-label={'Drop: ' + goal.title}
            >
              Drop
            </Button>
          </>
        ) : (
          <Button
            size="xs"
            variant="outline"
            disabled={busy}
            onClick={() => onStatus('active')}
            aria-label={'Reopen: ' + goal.title}
          >
            Reopen
          </Button>
        )}
        {confirming ? (
          <>
            <Button
              size="xs"
              color="danger"
              disabled={busy}
              onClick={onDelete}
              ref={confirmRef}
              aria-label={'Confirm delete: ' + goal.title}
            >
              Confirm delete
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => toggleConfirm(false)}
              aria-label={'Keep: ' + goal.title}
            >
              Keep
            </Button>
          </>
        ) : (
          <Button
            size="xs"
            variant="ghost"
            disabled={busy}
            onClick={() => toggleConfirm(true)}
            ref={deleteRef}
            aria-label={'Delete: ' + goal.title}
          >
            Delete
          </Button>
        )}
      </div>
    </li>
  );
};

const GoalsPage = () => {
  const now = useToday();
  const { goals, loaded, error, pending, waiting, isBusy, reload, add, update, remove } =
    useGoals();
  // After a goal moves section or is deleted, its button is gone, so focus goes to the status line.
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [area, setArea] = useState<GoalArea>('general');
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return setFormError('Give the goal a title.');
    const submitted = { title: title.trim(), description, targetDate };
    setFormError(null);
    setAnnouncement('');
    const message = await add({
      title: submitted.title,
      description: submitted.description,
      area,
      targetDate: submitted.targetDate || null,
    });
    if (message) return setFormError(message);
    setAnnouncement('Added goal: ' + submitted.title + '.');
    // Clear only what was sent, so anything typed while saving stays.
    setTitle((value) => (value.trim() === submitted.title ? '' : value));
    setDescription((value) => (value === submitted.description ? '' : value));
    setTargetDate((value) => (value === submitted.targetDate ? '' : value));
    // The area stays as chosen, so several goals for one area can be added in a row.
  };

  // Results go to the status line, which also takes focus because the pressed button is gone.
  const settle = (message: string | null, success: string) => {
    if (message) setActionError(message);
    else setAnnouncement(success);
    statusRef.current?.focus();
  };
  // The area select stays on the page, so focus stays on it and only the status line changes.
  const changeArea = async (goal: Goal, next: GoalArea) => {
    setActionError(null);
    setAnnouncement('');
    const message = await update(getGoalId(goal), { area: next });
    if (message) setActionError(message);
    else setAnnouncement(goal.title + ' is now a ' + goalAreaLabel[next].toLowerCase() + ' goal.');
  };
  const changeStatus = async (goal: Goal, status: GoalStatus) => {
    setActionError(null);
    setAnnouncement('');
    const message = await update(getGoalId(goal), { status });
    settle(message, goal.title + ' is now ' + goalStatusLabel[status].toLowerCase() + '.');
  };
  const removeGoal = async (goal: Goal) => {
    setActionError(null);
    setAnnouncement('');
    const message = await remove(getGoalId(goal));
    settle(message, 'Deleted goal: ' + goal.title + '.');
  };

  let status = announcement;
  if (pending) status = waiting ? 'Still loading your goals...' : 'Loading your goals...';
  else if (error) status = 'Your goals could not be loaded.';

  return (
    <Stack gap={{ base: 6, md: 8 }}>
      <div>
        <h1 className="tf-h1 os-m-0">Goals</h1>
        <p className="os-text-muted os-mt-2 os-mb-0">
          What you are working toward. Check in on them in your weekly review.
        </p>
        <p
          ref={statusRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="os-text-sm os-text-muted os-mt-1 os-mb-0"
        >
          {status}
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        aria-labelledby="new-goal-heading"
        className="tf-panel os-p-4 md:os-p-5"
      >
        <h2 id="new-goal-heading" className="tf-h3 os-mt-0 os-mb-4">
          Add a goal
        </h2>
        <Stack gap={4}>
          <Field label="Title" required>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={GOAL_TITLE_MAX}
              invalid={formError === 'Give the goal a title.'}
            />
          </Field>
          <Field label="Why it matters (optional)">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              maxLength={GOAL_DESCRIPTION_MAX}
            />
          </Field>
          <Field label="Area">
            <Select
              value={area}
              onChange={(event) => setArea(event.target.value as GoalArea)}
              className={styles.narrow}
            >
              {GOAL_AREAS.map((option) => (
                <option key={option} value={option}>
                  {goalAreaLabel[option]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Target date (optional)">
            <Input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              className={styles.narrow}
            />
          </Field>
          {formError && (
            <p role="alert" className="os-text-danger os-m-0">
              {formError}
            </p>
          )}
          <div className="os-flex">
            <Button
              type="submit"
              color="primary"
              loading={isBusy('new')}
              // Adding before the list loads could be overwritten by that first load.
              disabled={!loaded}
              leftIcon={<LuPlus focusable="false" />}
            >
              Add goal
            </Button>
          </div>
        </Stack>
      </form>

      {error && !pending && (
        <Stack gap={2} align="start">
          <p className="os-text-danger os-m-0">{error}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAnnouncement('');
              reload();
            }}
          >
            Retry loading goals
          </Button>
        </Stack>
      )}
      {actionError && (
        <p role="alert" className="os-text-danger os-m-0">
          {actionError}
        </p>
      )}

      {loaded &&
        GOAL_STATUSES.map((group) => {
          const items = goals.filter((goal) => goal.status === group);
          if (group !== 'active' && items.length === 0) return null;
          return (
            <section
              key={group}
              aria-labelledby={'goals-' + group}
              className="tf-panel os-p-4 md:os-p-5"
            >
              <h2 id={'goals-' + group} className="tf-h3 os-mt-0 os-mb-2">
                {sectionTitle[group]}{' '}
                <Badge color="neutral" size="sm">
                  {items.length}
                </Badge>
              </h2>
              {items.length ? (
                <ul className="os-list-unstyled os-m-0">
                  {items.map((goal) => (
                    <GoalRow
                      key={getGoalId(goal)}
                      goal={goal}
                      now={now}
                      busy={isBusy(getGoalId(goal))}
                      onStatus={(next) => void changeStatus(goal, next)}
                      onArea={(next) => void changeArea(goal, next)}
                      onDelete={() => void removeGoal(goal)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="os-text-muted os-m-0">No active goals yet. Add one above.</p>
              )}
            </section>
          );
        })}
    </Stack>
  );
};

export default GoalsPage;
