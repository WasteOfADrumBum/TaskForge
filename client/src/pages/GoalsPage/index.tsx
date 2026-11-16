import {
  Badge,
  Box,
  Button,
  Field,
  Heading,
  HStack,
  Input,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LuPlus } from 'react-icons/lu';
import { useGoals } from '../../hooks/useGoals';
import { useToday } from '../../hooks/useToday';
import {
  GOAL_DESCRIPTION_MAX,
  GOAL_STATUSES,
  GOAL_TITLE_MAX,
  getGoalId,
  goalStatusLabel,
  type Goal,
  type GoalStatus,
} from '../../types/goal';
import { goalTargetText } from '../../utils/goals';

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
  onDelete,
}: {
  goal: Goal;
  now: Date;
  busy: boolean;
  onStatus: (status: GoalStatus) => void;
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
  return (
    <Box as="li" py={3} borderTopWidth="1px" borderColor="border.muted">
      <Text fontWeight="medium" overflowWrap="anywhere">
        {goal.title}
      </Text>
      {goal.description && (
        <Text fontSize="sm" color="fg.muted" overflowWrap="anywhere" whiteSpace="pre-wrap">
          {goal.description}
        </Text>
      )}
      {target && (
        <Text fontSize="sm" color="fg.muted">
          {target}
        </Text>
      )}
      <HStack gap={2} mt={2} flexWrap="wrap">
        {goal.status === 'active' ? (
          <>
            <Button
              size="xs"
              variant="outline"
              disabled={busy}
              onClick={() => onStatus('achieved')}
            >
              Mark achieved
              <Box as="span" srOnly>
                : {goal.title}
              </Box>
            </Button>
            <Button size="xs" variant="ghost" disabled={busy} onClick={() => onStatus('dropped')}>
              Drop
              <Box as="span" srOnly>
                : {goal.title}
              </Box>
            </Button>
          </>
        ) : (
          <Button size="xs" variant="outline" disabled={busy} onClick={() => onStatus('active')}>
            Reopen
            <Box as="span" srOnly>
              : {goal.title}
            </Box>
          </Button>
        )}
        {confirming ? (
          <>
            <Button
              size="xs"
              colorPalette="red"
              disabled={busy}
              onClick={onDelete}
              ref={confirmRef}
            >
              Confirm delete
              <Box as="span" srOnly>
                : {goal.title}
              </Box>
            </Button>
            <Button size="xs" variant="ghost" onClick={() => toggleConfirm(false)}>
              Keep
              <Box as="span" srOnly>
                : {goal.title}
              </Box>
            </Button>
          </>
        ) : (
          <Button
            size="xs"
            variant="ghost"
            disabled={busy}
            onClick={() => toggleConfirm(true)}
            ref={deleteRef}
          >
            Delete
            <Box as="span" srOnly>
              : {goal.title}
            </Box>
          </Button>
        )}
      </HStack>
    </Box>
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
      targetDate: submitted.targetDate || null,
    });
    if (message) return setFormError(message);
    setAnnouncement('Added goal: ' + submitted.title + '.');
    // Clear only what was sent, so anything typed while saving stays.
    setTitle((value) => (value.trim() === submitted.title ? '' : value));
    setDescription((value) => (value === submitted.description ? '' : value));
    setTargetDate((value) => (value === submitted.targetDate ? '' : value));
  };

  // Results go to the status line, which also takes focus because the pressed button is gone.
  const settle = (message: string | null, success: string) => {
    if (message) setActionError(message);
    else setAnnouncement(success);
    statusRef.current?.focus();
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
    <VStack align="stretch" gap={{ base: 6, md: 8 }}>
      <Box>
        <Heading as="h1" size={{ base: '2xl', md: '3xl' }}>
          Goals
        </Heading>
        <Text color="fg.muted" mt={1.5}>
          What you are working toward. Check in on them in your weekly review.
        </Text>
        <Text
          ref={statusRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          fontSize="sm"
          color="fg.muted"
          mt={1}
          _focusVisible={{ outline: '2px solid', outlineColor: 'accent.teal' }}
        >
          {status}
        </Text>
      </Box>

      <Box
        as="form"
        onSubmit={onSubmit}
        aria-labelledby="new-goal-heading"
        bg="bg.panel"
        borderWidth="1px"
        borderRadius="lg"
        p={{ base: 4, md: 5 }}
      >
        <Heading as="h2" id="new-goal-heading" size="md" mb={4}>
          Add a goal
        </Heading>
        <VStack align="stretch" gap={4}>
          <Field.Root required invalid={formError === 'Give the goal a title.'}>
            <Field.Label>
              Title
              <Field.RequiredIndicator />
            </Field.Label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={GOAL_TITLE_MAX}
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>Why it matters (optional)</Field.Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              maxLength={GOAL_DESCRIPTION_MAX}
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>Target date (optional)</Field.Label>
            <Input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              maxW="12rem"
            />
          </Field.Root>
          {formError && (
            <Text role="alert" color="fg.error">
              {formError}
            </Text>
          )}
          <HStack>
            <Button
              type="submit"
              colorPalette="teal"
              loading={isBusy('new')}
              // Adding before the list loads could be overwritten by that first load.
              disabled={!loaded}
            >
              <LuPlus aria-hidden="true" focusable="false" />
              Add goal
            </Button>
          </HStack>
        </VStack>
      </Box>

      {error && !pending && (
        <VStack align="start" gap={2}>
          <Text color="fg.error">{error}</Text>
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
        </VStack>
      )}
      {actionError && (
        <Text role="alert" color="fg.error">
          {actionError}
        </Text>
      )}

      {loaded &&
        GOAL_STATUSES.map((group) => {
          const items = goals.filter((goal) => goal.status === group);
          if (group !== 'active' && items.length === 0) return null;
          return (
            <Box
              key={group}
              as="section"
              aria-labelledby={'goals-' + group}
              bg="bg.panel"
              borderWidth="1px"
              borderRadius="lg"
              p={{ base: 4, md: 5 }}
            >
              <Heading as="h2" id={'goals-' + group} size="md" mb={2}>
                {sectionTitle[group]}{' '}
                <Badge variant="subtle" size="sm">
                  {items.length}
                </Badge>
              </Heading>
              {items.length ? (
                <Box as="ul" listStyleType="none" m={0} p={0}>
                  {items.map((goal) => (
                    <GoalRow
                      key={getGoalId(goal)}
                      goal={goal}
                      now={now}
                      busy={isBusy(getGoalId(goal))}
                      onStatus={(next) => void changeStatus(goal, next)}
                      onDelete={() => void removeGoal(goal)}
                    />
                  ))}
                </Box>
              ) : (
                <Text color="fg.muted">No active goals yet. Add one above.</Text>
              )}
            </Box>
          );
        })}
    </VStack>
  );
};

export default GoalsPage;
