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
import { useState, type FormEvent } from 'react';
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
            <Button size="xs" colorPalette="red" disabled={busy} onClick={onDelete}>
              Confirm delete
              <Box as="span" srOnly>
                : {goal.title}
              </Box>
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setConfirming(false)}>
              Keep
              <Box as="span" srOnly>
                : {goal.title}
              </Box>
            </Button>
          </>
        ) : (
          <Button size="xs" variant="ghost" disabled={busy} onClick={() => setConfirming(true)}>
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
  const { goals, loaded, error, pending, waiting, busyId, reload, add, update, remove } =
    useGoals();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return setFormError('Give the goal a title.');
    setFormError(null);
    const message = await add({
      title: title.trim(),
      description,
      targetDate: targetDate || null,
    });
    if (message) return setFormError(message);
    setAnnouncement('Added goal: ' + title.trim() + '.');
    setTitle('');
    setDescription('');
    setTargetDate('');
  };

  const changeStatus = async (goal: Goal, status: GoalStatus) => {
    setActionError(null);
    const message = await update(getGoalId(goal), { status });
    if (message) setActionError(message);
    else setAnnouncement(goal.title + ' is now ' + goalStatusLabel[status].toLowerCase() + '.');
  };
  const removeGoal = async (goal: Goal) => {
    setActionError(null);
    const message = await remove(getGoalId(goal));
    if (message) setActionError(message);
    else setAnnouncement('Deleted goal: ' + goal.title + '.');
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
        <Text role="status" aria-live="polite" fontSize="sm" color="fg.muted" mt={1}>
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
            <Button type="submit" colorPalette="teal" loading={busyId === 'new'}>
              <LuPlus aria-hidden="true" focusable="false" />
              Add goal
            </Button>
          </HStack>
        </VStack>
      </Box>

      {error && !pending && (
        <VStack align="start" gap={2}>
          <Text color="fg.error">{error}</Text>
          <Button size="sm" variant="outline" onClick={reload}>
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
                      busy={busyId === getGoalId(goal)}
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
