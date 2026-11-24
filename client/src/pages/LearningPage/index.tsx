import { Badge, Button, Field, Input, Select, Stack, Textarea } from '@onesmall/ui';
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
  LEARNING_URL_MAX,
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
import { getPortfolioIdeas, hasOpenProject, type PortfolioIdea } from '../../utils/portfolio';
import { getOpenJobGaps, TOP_GAP_LIMIT } from '../../utils/skillGrowth';
import styles from './Learning.module.css';

const TITLE_ERROR = 'Give the item a title.';
const SKILL_ERROR = 'Use letters, numbers, spaces or hyphens for the skill, up to 40.';
const LINK_ERROR = 'Use a full https link, for example https://example.com/course.';
const ROADMAP_FIRST = 'Your roadmap must load before you can add to it.';

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
    <li className="os-py-3 os-border-top">
      <p className={`os-font-medium os-m-0 os-max-w-none ${styles.wrap}`}>{item.title}</p>
      <p className="os-text-sm os-text-muted os-m-0">{meta}</p>
      {item.notes && (
        <p
          className={`os-text-sm os-text-muted os-m-0 os-max-w-none ${styles.wrap} ${styles.preWrap}`}
        >
          {item.notes}
        </p>
      )}
      <div className="os-flex os-items-center os-gap-2 os-mt-2 os-flex-wrap">
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={`os-text-sm ${styles.iconLink}`}
            aria-label={'Open link: ' + item.title + ' (opens in a new tab)'}
          >
            Open link
            <LuExternalLink aria-hidden="true" focusable="false" />
          </a>
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
      </div>
    </li>
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
  const [ideaBusy, setIdeaBusy] = useState<string[]>([]);
  // Skills with an add in flight, checked synchronously so two presses in one tick add once.
  const adding = useRef(new Set<string>());

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
  const ideas = useMemo(
    () => getPortfolioIdeas(skills.items, jobs.items),
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
    if (slug === null) return setFormError(SKILL_ERROR);
    if (url.trim() && !safeHttpsUrl(url.trim())) return setFormError(LINK_ERROR);
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
    const key = 'gap:' + gapSkill;
    if (adding.current.has(key)) return;
    adding.current.add(key);
    begin();
    setGapBusy((current) => [...current, gapSkill]);
    const itemTitle = gapItemTitle(gapSkill);
    const message = await items.add((token) =>
      createLearningItem(token, { title: itemTitle, skill: gapSkill, kind: 'course' }),
    );
    adding.current.delete(key);
    setGapBusy((current) => current.filter((entry) => entry !== gapSkill));
    // The button is replaced by "On your roadmap", so the status line takes focus.
    settle(message, 'Added to your roadmap: ' + itemTitle + '.');
  };

  const addIdea = async (idea: PortfolioIdea) => {
    const key = 'project:' + idea.skill;
    if (adding.current.has(key)) return;
    adding.current.add(key);
    begin();
    setIdeaBusy((current) => [...current, idea.skill]);
    const message = await items.add((token) =>
      createLearningItem(token, {
        title: idea.title,
        skill: idea.skill,
        kind: 'project',
        notes: idea.notes,
      }),
    );
    adding.current.delete(key);
    setIdeaBusy((current) => current.filter((entry) => entry !== idea.skill));
    // The button is replaced by "On your roadmap", so the status line takes focus.
    settle(message, 'Added to your roadmap: ' + idea.title + '.');
  };

  let status = announcement;
  if (items.pending)
    status = items.waiting ? 'Still loading your roadmap...' : 'Loading your roadmap...';
  // A failed reload keeps the list on screen, so only a list that never loaded is reported here.
  else if (items.error && !items.loaded) status = 'Your roadmap could not be loaded.';
  const roadmapBlocked = !items.loaded && !!items.error && !items.pending;

  return (
    <Stack gap={{ base: 6, md: 8 }}>
      <div>
        <h1 className="tf-h1 os-m-0">Learning</h1>
        <p className="os-text-muted os-m-0 os-mt-2">
          Your learning roadmap: courses, articles and projects, each tied to a skill if you like.
        </p>
        <p
          ref={statusRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="os-text-sm os-text-muted os-m-0 os-mt-1"
        >
          {status}
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        aria-labelledby="new-learning-heading"
        className="tf-panel os-p-4 md:os-p-5"
      >
        <h2 id="new-learning-heading" className="tf-h2 os-m-0 os-mb-4">
          Add to your roadmap
        </h2>
        <Stack gap={4}>
          <Field label="Title" required>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={LEARNING_TITLE_MAX}
              invalid={formError === TITLE_ERROR}
            />
          </Field>
          <div className="os-flex os-items-start os-gap-4 os-flex-wrap">
            <Field
              label="Skill (optional)"
              hint="Matches the skills on your Career page by name."
              className={styles.grow}
            >
              <Input
                value={skill}
                onChange={(event) => setSkill(event.target.value)}
                maxLength={40}
                invalid={formError === SKILL_ERROR}
              />
            </Field>
            <Field label="Kind" className={styles.growNarrow}>
              <Select
                value={kind}
                onChange={(event) => setKind(event.target.value as LearningKind)}
              >
                {LEARNING_KINDS.map((option) => (
                  <option key={option} value={option}>
                    {learningKindLabel[option]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Link (optional, https)">
            <Input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              maxLength={LEARNING_URL_MAX}
              invalid={formError === LINK_ERROR}
            />
          </Field>
          <Field label="Target date (optional)">
            <Input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              className={styles.dateInput}
            />
          </Field>
          <Field label="Notes (optional)">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              maxLength={LEARNING_NOTES_MAX}
            />
          </Field>
          {formError && (
            <p role="alert" className="os-text-danger os-m-0">
              {formError}
            </p>
          )}
          {roadmapBlocked && (
            <p id="learning-add-blocked" className="os-text-sm os-text-muted os-m-0">
              {ROADMAP_FIRST}
            </p>
          )}
          <div className="os-flex os-items-center">
            <Button
              type="submit"
              loading={items.isBusy('new')}
              // Adding before the list loads could be overwritten by that first load.
              disabled={!items.loaded}
              aria-describedby={roadmapBlocked ? 'learning-add-blocked' : undefined}
              leftIcon={<LuPlus aria-hidden="true" focusable="false" />}
            >
              Add to roadmap
            </Button>
          </div>
        </Stack>
      </form>

      <section aria-labelledby="learning-gaps" className="tf-panel os-p-4 md:os-p-5">
        <h2 id="learning-gaps" className="tf-h2 os-m-0 os-mb-1">
          From your skill gaps
        </h2>
        <p className="os-text-sm os-text-muted os-m-0 os-mb-2">
          The skills your open saved jobs need that are not in your skills yet. Rule-based.
        </p>
        {careerError && !(skills.pending || jobs.pending) ? (
          <Stack gap={2} align="flex-start">
            <p role="alert" className="os-text-danger os-m-0">
              {careerError}
            </p>
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
          </Stack>
        ) : roadmapBlocked ? (
          <p className="os-text-muted os-m-0">{ROADMAP_FIRST}</p>
        ) : !careerLoaded || !items.loaded ? (
          <p className="os-text-muted os-m-0">Loading your skill gaps...</p>
        ) : gaps.gaps.length ? (
          <ul
            role="list"
            className="os-list-unstyled os-m-0 os-p-0"
            aria-label="Skills your open saved jobs need"
          >
            {gaps.gaps.map((gap) => {
              const planned = hasOpenLearning(items.items, gap.skill);
              return (
                <li
                  key={gap.skill}
                  className="os-flex os-items-center os-justify-between os-gap-3 os-py-2 os-border-top os-flex-wrap"
                >
                  <p className={`os-m-0 ${styles.wrap}`}>
                    {gap.skill}: needed by {gap.jobs} {gap.jobs === 1 ? 'job' : 'jobs'}
                  </p>
                  {planned ? (
                    <p className="os-text-sm os-text-muted os-m-0">On your roadmap</p>
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
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="os-text-muted os-m-0">
            {gaps.hasOpenJobs
              ? 'Your skills cover every open saved job.'
              : 'Save jobs on the Career page to see the skills they need.'}
          </p>
        )}
        <RouterLink to="/career" className="os-text-sm os-inline-block os-mt-3">
          Update skills and jobs in Career
        </RouterLink>
      </section>

      <section aria-labelledby="learning-projects" className="tf-panel os-p-4 md:os-p-5">
        <h2 id="learning-projects" className="tf-h2 os-m-0 os-mb-1">
          Portfolio project ideas
        </h2>
        <p className="os-text-sm os-text-muted os-m-0 os-mb-2">
          Each idea pairs a skill your open saved jobs need with a skill you already have at working
          level or above that those jobs list. Rule-based.
        </p>
        {careerError && !(skills.pending || jobs.pending) ? (
          <p className="os-text-muted os-m-0">
            Project ideas need your skills and saved jobs. Use the retry above.
          </p>
        ) : roadmapBlocked ? (
          <p className="os-text-muted os-m-0">{ROADMAP_FIRST}</p>
        ) : !careerLoaded || !items.loaded ? (
          <p className="os-text-muted os-m-0">Loading project ideas...</p>
        ) : ideas.length ? (
          <ul
            role="list"
            className="os-list-unstyled os-m-0 os-p-0"
            aria-label="Portfolio project ideas from your skill gaps"
          >
            {ideas.map((idea) => {
              const planned = hasOpenProject(items.items, idea.skill);
              return (
                <li key={idea.skill} className="os-py-2 os-border-top">
                  <div className="os-flex os-items-center os-justify-between os-gap-3 os-flex-wrap">
                    <p className={`os-font-medium os-m-0 ${styles.wrap}`}>{idea.title}</p>
                    {planned ? (
                      <p className="os-text-sm os-text-muted os-m-0">On your roadmap</p>
                    ) : (
                      <Button
                        size="xs"
                        variant="outline"
                        aria-disabled={ideaBusy.includes(idea.skill) || undefined}
                        onClick={() => void addIdea(idea)}
                        aria-label={'Add project: ' + idea.title}
                      >
                        Add project
                      </Button>
                    )}
                  </div>
                  <p className={`os-text-sm os-text-muted os-m-0 os-max-w-none ${styles.wrap}`}>
                    {idea.notes}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="os-text-muted os-m-0">
            {gaps.hasOpenJobs
              ? 'Your skills cover every open saved job, so there are no gaps to build a project around.'
              : 'Save jobs on the Career page to get project ideas from the skills they need.'}
          </p>
        )}
      </section>

      {items.error && !items.pending && (
        <Stack gap={2} align="flex-start">
          <p className="os-text-danger os-m-0">{items.error}</p>
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
        </Stack>
      )}
      {actionError && (
        <p role="alert" className="os-text-danger os-m-0">
          {actionError}
        </p>
      )}

      {items.loaded &&
        LEARNING_STATUSES.map((group) => {
          const list = learningInStatus(items.items, group);
          if (group === 'done' && list.length === 0) return null;
          return (
            <section
              key={group}
              aria-labelledby={'learning-' + group}
              className="tf-panel os-p-4 md:os-p-5"
            >
              <h2 id={'learning-' + group} className="tf-h2 os-m-0 os-mb-2">
                {learningStatusLabel[group]} <Badge size="sm">{list.length}</Badge>
              </h2>
              {list.length ? (
                <ul role="list" className="os-list-unstyled os-m-0 os-p-0">
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
                </ul>
              ) : (
                <p className="os-text-muted os-m-0">
                  {group === 'in_progress' ? 'Nothing in progress.' : 'Nothing planned yet.'}
                </p>
              )}
            </section>
          );
        })}
    </Stack>
  );
};

export default LearningPage;
