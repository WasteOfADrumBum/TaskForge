import {
  Badge,
  Box,
  Button,
  chakra,
  Field,
  Heading,
  HStack,
  Input,
  Link,
  NativeSelect,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { LuExternalLink, LuPlus } from 'react-icons/lu';
import { Link as RouterLink } from 'react-router-dom';
import { getJobs, getSkills } from '../../api/career';
import {
  createLearningItem,
  deleteLearningItem,
  getLearning,
  updateLearningItem,
} from '../../api/learning';
import ConfirmDeleteButton from '../../components/common/ConfirmDeleteButton';
import { useOwnedList } from '../../hooks/useOwnedList';
import { useToday } from '../../hooks/useToday';
import type { SavedJob, Skill } from '../../types/career';
import {
  LEARNING_KINDS,
  LEARNING_NOTES_MAX,
  LEARNING_STATUSES,
  LEARNING_TITLE_MAX,
  learningKindLabel,
  learningStatusLabel,
  type LearningItem,
  type LearningKind,
  type LearningStatus,
} from '../../types/learning';
import { safeHttpsUrl, toSkillSlug } from '../../utils/career';
import {
  gapItemTitle,
  getLearningId,
  hasOpenLearning,
  learningInStatus,
  learningTargetText,
} from '../../utils/learning';
import { getOpenJobGaps, TOP_GAP_LIMIT } from '../../utils/skillGrowth';

const panel = {
  bg: 'bg.panel',
  borderWidth: '1px',
  borderRadius: 'lg',
  p: { base: 4, md: 5 },
} as const;

const TITLE_ERROR = 'Give the item a title.';

// The status moves offered for each status, as [label, next status].
const moves: Record<LearningStatus, Array<[string, LearningStatus]>> = {
  planned: [
    ['Start', 'in_progress'],
    ['Mark done', 'done'],
  ],
  in_progress: [
    ['Mark done', 'done'],
    ['Back to planned', 'planned'],
  ],
  done: [['Reopen', 'in_progress']],
};

const LearningRow = ({
  item,
  now,
  busy,
  onMove,
  onDelete,
}: {
  item: LearningItem;
  now: Date;
  busy: boolean;
  onMove: (status: LearningStatus) => void;
  onDelete: () => void;
}) => {
  const link = safeHttpsUrl(item.url);
  const target = learningTargetText(item, now);
  const meta = [learningKindLabel[item.kind], item.skill ? 'Skill: ' + item.skill : null, target]
    .filter(Boolean)
    .join(' · ');
  return (
    <Box as="li" py={3} borderTopWidth="1px" borderColor="border.muted">
      <Text fontWeight="medium" overflowWrap="anywhere">
        {item.title}
      </Text>
      <Text fontSize="sm" color="fg.muted">
        {meta}
      </Text>
      {item.notes && (
        <Text fontSize="sm" color="fg.muted" overflowWrap="anywhere" whiteSpace="pre-wrap">
          {item.notes}
        </Text>
      )}
      <HStack gap={2} mt={2} flexWrap="wrap">
        {link && (
          <Link
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            fontSize="sm"
            color="accent.teal"
            aria-label={'Open link: ' + item.title + ' (opens in a new tab)'}
          >
            Open link
            <LuExternalLink aria-hidden="true" focusable="false" />
          </Link>
        )}
        {moves[item.status].map(([label, next]) => (
          <Button
            key={label}
            size="xs"
            variant={next === 'done' ? 'outline' : 'ghost'}
            // aria-disabled rather than disabled, so focus stays put while the change runs.
            aria-disabled={busy || undefined}
            onClick={() => {
              if (!busy) onMove(next);
            }}
            aria-label={label + ': ' + item.title}
          >
            {label}
          </Button>
        ))}
        <ConfirmDeleteButton name={item.title} busy={busy} onConfirm={onDelete} />
      </HStack>
    </Box>
  );
};

// The learning roadmap: courses, articles and projects, optionally tied to a skill, with a
// shortcut from the skills open saved jobs need. Everything shown is rule-based.
const LearningPage = () => {
  const now = useToday();
  const items = useOwnedList<LearningItem>(getLearning, 'Unable to load your roadmap');
  const skills = useOwnedList<Skill>(getSkills, 'Unable to load skills');
  const jobs = useOwnedList<SavedJob>(getJobs, 'Unable to load saved jobs');
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [announcement, setAnnouncement] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [gapBusy, setGapBusy] = useState<string[]>([]);

  const [title, setTitle] = useState('');
  const [skill, setSkill] = useState('');
  const [kind, setKind] = useState<LearningKind>('course');
  const [url, setUrl] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const careerLoaded = skills.loaded && jobs.loaded;
  const careerError = skills.error ?? jobs.error;
  const gaps = useMemo(
    () => getOpenJobGaps(skills.items, jobs.items, TOP_GAP_LIMIT),
    [skills.items, jobs.items],
  );

  const begin = () => {
    setAnnouncement('');
    setActionError(null);
  };
  // Results go to the status line, which takes focus when the pressed button has gone.
  const settle = (message: string | null, success: string) => {
    if (message) setActionError(message);
    else {
      setAnnouncement(success);
      statusRef.current?.focus();
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return setFormError(TITLE_ERROR);
    const slug = skill.trim() ? toSkillSlug(skill) : '';
    if (slug === null) {
      return setFormError('Use letters, numbers, spaces or hyphens for the skill, up to 40.');
    }
    if (url.trim() && !safeHttpsUrl(url.trim())) {
      return setFormError('Use a full https link, for example https://example.com/course.');
    }
    setFormError(null);
    begin();
    const sent = { title: title.trim(), skill, kind, url: url.trim(), targetDate, notes };
    const message = await items.add((token) =>
      createLearningItem(token, {
        title: sent.title,
        skill: slug,
        kind: sent.kind,
        url: sent.url,
        targetDate: sent.targetDate || null,
        notes: sent.notes,
      }),
    );
    if (message) return setFormError(message);
    setAnnouncement('Added to your roadmap: ' + sent.title + '.');
    // Clear only what was sent, so anything typed while saving stays.
    setTitle((value) => (value.trim() === sent.title ? '' : value));
    setSkill((value) => (value === sent.skill ? '' : value));
    setUrl((value) => (value.trim() === sent.url ? '' : value));
    setTargetDate((value) => (value === sent.targetDate ? '' : value));
    setNotes((value) => (value === sent.notes ? '' : value));
  };

  const move = async (item: LearningItem, status: LearningStatus) => {
    begin();
    const id = getLearningId(item);
    const message = await items.update(id, (token) => updateLearningItem(token, id, { status }));
    settle(message, item.title + ' is now ' + learningStatusLabel[status].toLowerCase() + '.');
  };
  const remove = async (item: LearningItem) => {
    begin();
    const id = getLearningId(item);
    const message = await items.remove(id, (token) => deleteLearningItem(token, id));
    settle(message, 'Deleted from your roadmap: ' + item.title + '.');
  };
  const addFromGap = async (gapSkill: string) => {
    if (gapBusy.includes(gapSkill)) return;
    begin();
    setGapBusy((current) => [...current, gapSkill]);
    const itemTitle = gapItemTitle(gapSkill);
    const message = await items.add((token) =>
      createLearningItem(token, { title: itemTitle, skill: gapSkill, kind: 'course' }),
    );
    setGapBusy((current) => current.filter((entry) => entry !== gapSkill));
    // The button is replaced by "On your roadmap", so the status line takes focus.
    settle(message, 'Added to your roadmap: ' + itemTitle + '.');
  };

  let status = announcement;
  if (items.pending)
    status = items.waiting ? 'Still loading your roadmap...' : 'Loading your roadmap...';
  else if (items.error) status = 'Your roadmap could not be loaded.';

  return (
    <VStack align="stretch" gap={{ base: 6, md: 8 }}>
      <Box>
        <Heading as="h1" size={{ base: '2xl', md: '3xl' }}>
          Learning
        </Heading>
        <Text color="fg.muted" mt={1.5}>
          Your learning roadmap: courses, articles and projects, each tied to a skill if you like.
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

      <chakra.form onSubmit={onSubmit} noValidate aria-labelledby="new-learning-heading" {...panel}>
        <Heading as="h2" id="new-learning-heading" size="md" mb={4}>
          Add to your roadmap
        </Heading>
        <VStack align="stretch" gap={4}>
          <Field.Root required invalid={formError === TITLE_ERROR}>
            <Field.Label>
              Title
              <Field.RequiredIndicator />
            </Field.Label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={LEARNING_TITLE_MAX}
            />
          </Field.Root>
          <HStack gap={4} align="start" flexWrap="wrap">
            <Field.Root flex="1" minW="12rem">
              <Field.Label>Skill (optional)</Field.Label>
              <Input
                value={skill}
                onChange={(event) => setSkill(event.target.value)}
                maxLength={40}
              />
              <Field.HelperText>Matches the skills on your Career page by name.</Field.HelperText>
            </Field.Root>
            <Field.Root flex="1" minW="10rem">
              <Field.Label>Kind</Field.Label>
              <NativeSelect.Root>
                <NativeSelect.Field
                  value={kind}
                  onChange={(event) => setKind(event.target.value as LearningKind)}
                >
                  {LEARNING_KINDS.map((option) => (
                    <option key={option} value={option}>
                      {learningKindLabel[option]}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
          </HStack>
          <Field.Root>
            <Field.Label>Link (optional, https)</Field.Label>
            <Input type="url" value={url} onChange={(event) => setUrl(event.target.value)} />
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
          <Field.Root>
            <Field.Label>Notes (optional)</Field.Label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              maxLength={LEARNING_NOTES_MAX}
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
              loading={items.isBusy('new')}
              // Adding before the list loads could be overwritten by that first load.
              disabled={!items.loaded}
            >
              <LuPlus aria-hidden="true" focusable="false" />
              Add to roadmap
            </Button>
          </HStack>
        </VStack>
      </chakra.form>

      <Box as="section" aria-labelledby="learning-gaps" {...panel}>
        <Heading as="h2" id="learning-gaps" size="md" mb={1}>
          From your skill gaps
        </Heading>
        <Text fontSize="sm" color="fg.muted" mb={2}>
          The skills your open saved jobs need that are not in your skills yet. Rule-based.
        </Text>
        {careerError && !(skills.pending || jobs.pending) ? (
          <VStack align="start" gap={2}>
            <Text role="alert" color="fg.error">
              {careerError}
            </Text>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (skills.error) skills.reload();
                if (jobs.error) jobs.reload();
              }}
            >
              Retry loading skill gaps
            </Button>
          </VStack>
        ) : !careerLoaded || !items.loaded ? (
          <Text color="fg.muted">Loading your skill gaps...</Text>
        ) : gaps.gaps.length ? (
          <Box as="ul" role="list" listStyleType="none" m={0} p={0} aria-labelledby="learning-gaps">
            {gaps.gaps.map((gap) => {
              const planned = hasOpenLearning(items.items, gap.skill);
              return (
                <HStack
                  as="li"
                  key={gap.skill}
                  justify="space-between"
                  gap={3}
                  py={2}
                  borderTopWidth="1px"
                  borderColor="border.muted"
                  flexWrap="wrap"
                >
                  <Text overflowWrap="anywhere">
                    {gap.skill}: needed by {gap.jobs} {gap.jobs === 1 ? 'job' : 'jobs'}
                  </Text>
                  {planned ? (
                    <Text fontSize="sm" color="fg.muted">
                      On your roadmap
                    </Text>
                  ) : (
                    <Button
                      size="xs"
                      variant="outline"
                      aria-disabled={gapBusy.includes(gap.skill) || undefined}
                      onClick={() => void addFromGap(gap.skill)}
                      aria-label={'Add to roadmap: ' + gap.skill}
                    >
                      Add to roadmap
                    </Button>
                  )}
                </HStack>
              );
            })}
          </Box>
        ) : (
          <Text color="fg.muted">
            {gaps.hasOpenJobs
              ? 'Your skills cover every open saved job.'
              : 'Save jobs on the Career page to see the skills they need.'}
          </Text>
        )}
        <Link asChild fontSize="sm" color="accent.teal" mt={3} display="inline-block">
          <RouterLink to="/career">Update skills and jobs in Career</RouterLink>
        </Link>
      </Box>

      {items.error && !items.pending && (
        <VStack align="start" gap={2}>
          <Text color="fg.error">{items.error}</Text>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAnnouncement('');
              items.reload();
            }}
          >
            Retry loading roadmap
          </Button>
        </VStack>
      )}
      {actionError && (
        <Text role="alert" color="fg.error">
          {actionError}
        </Text>
      )}

      {items.loaded &&
        LEARNING_STATUSES.map((group) => {
          const list = learningInStatus(items.items, group);
          if (group === 'done' && list.length === 0) return null;
          return (
            <Box key={group} as="section" aria-labelledby={'learning-' + group} {...panel}>
              <Heading as="h2" id={'learning-' + group} size="md" mb={2}>
                {learningStatusLabel[group]}{' '}
                <Badge variant="subtle" size="sm">
                  {list.length}
                </Badge>
              </Heading>
              {list.length ? (
                <Box as="ul" role="list" listStyleType="none" m={0} p={0}>
                  {list.map((item) => (
                    <LearningRow
                      key={getLearningId(item)}
                      item={item}
                      now={now}
                      busy={items.isBusy(getLearningId(item))}
                      onMove={(next) => void move(item, next)}
                      onDelete={() => void remove(item)}
                    />
                  ))}
                </Box>
              ) : (
                <Text color="fg.muted">
                  {group === 'in_progress' ? 'Nothing in progress.' : 'Nothing planned yet.'}
                </Text>
              )}
            </Box>
          );
        })}
    </VStack>
  );
};

export default LearningPage;
