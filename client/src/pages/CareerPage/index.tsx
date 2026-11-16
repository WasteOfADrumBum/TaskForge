import {
  Badge,
  Box,
  chakra,
  Button,
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
import { useRef, useState, type FormEvent } from 'react';
import { LuExternalLink, LuPlus } from 'react-icons/lu';
import {
  createJob,
  createSkill,
  deleteJob,
  deleteSkill,
  getJobs,
  getSkills,
  updateJob,
  updateSkill,
} from '../../api/career';
import { isCurrentSession } from '../../api/authenticatedFetch';
import { createTask } from '../../api/tasks';
import ApplicationsSection from '../../components/career/ApplicationsSection';
import CareerGoals from '../../components/career/CareerGoals';
import ConfirmDeleteButton from '../../components/common/ConfirmDeleteButton';
import ResumeSection from '../../components/career/ResumeSection';
import { useOwnedList } from '../../hooks/useOwnedList';
import { followUpTaskTitle } from '../../utils/applications';
import { useAppDispatch, useAppSelector } from '../../redux/hooks/typedHooks';
import { addTask } from '../../redux/slices/taskSlice';
import {
  JOB_COMPANY_MAX,
  JOB_NOTES_MAX,
  JOB_STATUSES,
  JOB_TITLE_MAX,
  SKILL_LEVELS,
  SKILL_NAME_MAX,
  getRecordId,
  jobStatusLabel,
  skillLevelLabel,
  type JobStatus,
  type SavedJob,
  type Skill,
  type SkillLevel,
} from '../../types/career';
import {
  safeHttpsUrl,
  getSkillGap,
  hasLearningTask,
  learningTaskTitle,
  parseSkillList,
  toSkillSlug,
} from '../../utils/career';
import { SessionExpiredError } from '../../utils/session';

const panel = {
  bg: 'bg.panel',
  borderWidth: '1px',
  borderRadius: 'lg',
  p: { base: 4, md: 5 },
} as const;

const CareerPage = () => {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  const tasks = useAppSelector((state) => state.tasks.items);
  const tasksLoaded = useAppSelector((state) => state.tasks.loaded);
  const skills = useOwnedList<Skill>(getSkills, 'Unable to load skills');
  const jobs = useOwnedList<SavedJob>(getJobs, 'Unable to load saved jobs');
  const [announcement, setAnnouncement] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  // Skill form
  const [skillName, setSkillName] = useState('');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('working');
  const [skillError, setSkillError] = useState<string | null>(null);
  // Job form
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [url, setUrl] = useState('');
  const [skillList, setSkillList] = useState('');
  const [notes, setNotes] = useState('');
  const [jobError, setJobError] = useState<string | null>(null);
  const [taskBusy, setTaskBusy] = useState<string[]>([]);
  // Follow-up adds in flight, checked synchronously so two presses in one tick add once.
  const followingUp = useRef(new Set<string>());

  const begin = () => {
    setAnnouncement('');
    setActionError(null);
  };
  // Results go to the status line, which takes focus when the pressed button has gone.
  const settle = (message: string | null, success: string, moveFocus = false) => {
    if (message) setActionError(message);
    else {
      setAnnouncement(success);
      if (moveFocus) statusRef.current?.focus();
    }
  };

  const addSkill = async (event: FormEvent) => {
    event.preventDefault();
    const name = toSkillSlug(skillName);
    if (!skillName.trim()) {
      setSkillError('Enter a skill name.');
      return;
    }
    if (!name) {
      setSkillError('Use letters, numbers, spaces or hyphens, up to 40 characters.');
      return;
    }
    if (skills.items.some((skill) => skill.name === name)) {
      setSkillError(name + ' is already in your skills.');
      return;
    }
    setSkillError(null);
    begin();
    const message = await skills.add((current) =>
      createSkill(current, { name, level: skillLevel }),
    );
    if (message) return setSkillError(message);
    setAnnouncement('Added skill: ' + name + '.');
    setSkillName((value) => (toSkillSlug(value) === name ? '' : value));
  };

  const addJob = async (event: FormEvent) => {
    event.preventDefault();
    if (!jobTitle.trim()) return setJobError('Give the job a title.');
    if (url.trim() && !safeHttpsUrl(url.trim())) {
      return setJobError('Use a full https link, for example https://example.com/job.');
    }
    const parsed = parseSkillList(skillList);
    if ('invalid' in parsed) {
      return setJobError(
        '"' + parsed.invalid + '" is not a valid skill. Use letters, numbers, spaces or hyphens.',
      );
    }
    setJobError(null);
    begin();
    const sent = { title: jobTitle.trim(), company, url: url.trim(), skillList, notes };
    const message = await jobs.add((current) =>
      createJob(current, {
        title: sent.title,
        company: sent.company,
        url: sent.url,
        requiredSkills: parsed.skills,
        notes: sent.notes,
      }),
    );
    if (message) return setJobError(message);
    setAnnouncement('Saved job: ' + sent.title + '.');
    setJobTitle((value) => (value.trim() === sent.title ? '' : value));
    setCompany((value) => (value === sent.company ? '' : value));
    setUrl((value) => (value.trim() === sent.url ? '' : value));
    setSkillList((value) => (value === sent.skillList ? '' : value));
    setNotes((value) => (value === sent.notes ? '' : value));
  };

  const addLearningTask = async (skill: string, job: SavedJob) => {
    if (!token || !isCurrentSession(token, sessionVersion)) return;
    const key = getRecordId(job) + ':' + skill;
    const title = learningTaskTitle(skill, job);
    begin();
    setTaskBusy((current) => [...current, key]);
    try {
      const task = await createTask(token, {
        title,
        description:
          'Learning task for the saved job "' +
          job.title +
          (job.company ? '" at ' + job.company : '"') +
          '. Added from the Career skill gap.',
        priority: 'medium',
        status: 'todo',
      });
      if (!isCurrentSession(token, sessionVersion)) return;
      dispatch(addTask(task));
      // The button is replaced by "Learning task added", so focus the status line.
      settle(null, 'Added learning task: ' + title + '.', true);
    } catch (failure) {
      if (failure instanceof SessionExpiredError || !isCurrentSession(token, sessionVersion))
        return;
      setActionError(failure instanceof Error ? failure.message : 'Unable to add learning task');
    } finally {
      setTaskBusy((current) => current.filter((item) => item !== key));
    }
  };

  const addFollowUpTask = async (job: SavedJob) => {
    if (!token || !isCurrentSession(token, sessionVersion) || !tasksLoaded) return;
    const key = 'follow-up:' + getRecordId(job);
    if (followingUp.current.has(key)) return;
    followingUp.current.add(key);
    const title = followUpTaskTitle(job);
    begin();
    setTaskBusy((current) => [...current, key]);
    try {
      const task = await createTask(token, {
        title,
        description:
          'Follow-up for the application to "' +
          job.title +
          (job.company ? '" at ' + job.company : '"') +
          '. Added from Career applications.',
        priority: 'medium',
        status: 'todo',
      });
      if (!isCurrentSession(token, sessionVersion)) return;
      dispatch(addTask(task));
      // The button is replaced by "Follow-up task added", so focus the status line.
      settle(null, 'Added follow-up task: ' + title + '.', true);
    } catch (failure) {
      if (failure instanceof SessionExpiredError || !isCurrentSession(token, sessionVersion))
        return;
      setActionError(failure instanceof Error ? failure.message : 'Unable to add follow-up task');
    } finally {
      followingUp.current.delete(key);
      setTaskBusy((current) => current.filter((item) => item !== key));
    }
  };

  let status = announcement;
  if (skills.pending || jobs.pending)
    status = skills.waiting || jobs.waiting ? 'Still loading...' : 'Loading your career data...';

  return (
    <VStack align="stretch" gap={{ base: 6, md: 8 }}>
      <Box>
        <Heading as="h1" size={{ base: '2xl', md: '3xl' }}>
          Career
        </Heading>
        <Text color="fg.muted" mt={1.5}>
          Your skills and the jobs you are looking at. Skill gaps compare a job&apos;s required
          skills with yours by exact name. They are rule-based, not AI.
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
        {actionError && (
          <Text role="alert" color="fg.error" mt={1}>
            {actionError}
          </Text>
        )}
      </Box>

      <CareerGoals />

      <Box as="section" aria-labelledby="skills-heading" {...panel}>
        <Heading as="h2" id="skills-heading" size="md" mb={4}>
          Skills{' '}
          <Badge variant="subtle" size="sm">
            {skills.items.length}
          </Badge>
        </Heading>
        <chakra.form onSubmit={addSkill} aria-label="Add a skill" mb={4} noValidate>
          <HStack align="end" gap={3} flexWrap="wrap">
            <Field.Root required invalid={Boolean(skillError)} flex="1" minW="12rem">
              <Field.Label>
                Skill
                <Field.RequiredIndicator />
              </Field.Label>
              <Input
                value={skillName}
                onChange={(event) => setSkillName(event.target.value)}
                maxLength={SKILL_NAME_MAX}
                placeholder="For example, typescript"
              />
            </Field.Root>
            <Field.Root w="auto">
              <Field.Label>Level</Field.Label>
              <NativeSelect.Root>
                <NativeSelect.Field
                  value={skillLevel}
                  onChange={(event) => setSkillLevel(event.target.value as SkillLevel)}
                >
                  {SKILL_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {skillLevelLabel[level]}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            <Button
              type="submit"
              colorPalette="teal"
              loading={skills.isBusy('new')}
              disabled={!skills.loaded}
            >
              <LuPlus aria-hidden="true" focusable="false" />
              Add skill
            </Button>
          </HStack>
          {skillError && (
            <Text role="alert" color="fg.error" fontSize="sm" mt={2}>
              {skillError}
            </Text>
          )}
        </chakra.form>
        {skills.error && !skills.pending ? (
          <VStack align="start" gap={2}>
            <Text color="fg.error">{skills.error}</Text>
            <Button size="sm" variant="outline" onClick={skills.reload}>
              Retry loading skills
            </Button>
          </VStack>
        ) : skills.loaded && skills.items.length === 0 ? (
          <Text color="fg.muted">No skills yet. Add the ones you already use.</Text>
        ) : (
          <Box as="ul" listStyleType="none" m={0} p={0}>
            {skills.items.map((skill) => {
              const id = getRecordId(skill);
              return (
                <HStack
                  as="li"
                  key={id}
                  justify="space-between"
                  gap={3}
                  py={2}
                  borderTopWidth="1px"
                  borderColor="border.muted"
                  flexWrap="wrap"
                >
                  <Text fontWeight="medium" overflowWrap="anywhere">
                    {skill.name}
                  </Text>
                  <HStack gap={2}>
                    <NativeSelect.Root size="xs" w="auto">
                      <NativeSelect.Field
                        aria-label={'Level for ' + skill.name}
                        value={skill.level}
                        onChange={async (event) => {
                          const level = event.target.value as SkillLevel;
                          begin();
                          const message = await skills.update(id, (current) =>
                            updateSkill(current, id, { level }),
                          );
                          settle(message, skill.name + ' is now ' + skillLevelLabel[level] + '.');
                        }}
                      >
                        {SKILL_LEVELS.map((level) => (
                          <option key={level} value={level}>
                            {skillLevelLabel[level]}
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                    <ConfirmDeleteButton
                      name={skill.name}
                      label="Remove"
                      busy={skills.isBusy(id)}
                      onConfirm={async () => {
                        begin();
                        const message = await skills.remove(id, (current) =>
                          deleteSkill(current, id),
                        );
                        settle(message, 'Removed skill: ' + skill.name + '.', true);
                      }}
                    />
                  </HStack>
                </HStack>
              );
            })}
          </Box>
        )}
      </Box>

      <Box as="section" aria-labelledby="jobs-heading" {...panel}>
        <Heading as="h2" id="jobs-heading" size="md" mb={4}>
          Saved jobs{' '}
          <Badge variant="subtle" size="sm">
            {jobs.items.length}
          </Badge>
        </Heading>
        <chakra.form onSubmit={addJob} aria-label="Save a job" mb={4} noValidate>
          <VStack align="stretch" gap={3}>
            <Field.Root required invalid={jobError === 'Give the job a title.'}>
              <Field.Label>
                Job title
                <Field.RequiredIndicator />
              </Field.Label>
              <Input
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                maxLength={JOB_TITLE_MAX}
              />
            </Field.Root>
            <HStack gap={3} align="start" flexWrap="wrap">
              <Field.Root flex="1" minW="12rem">
                <Field.Label>Company (optional)</Field.Label>
                <Input
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  maxLength={JOB_COMPANY_MAX}
                />
              </Field.Root>
              <Field.Root flex="1" minW="12rem">
                <Field.Label>Link (optional, https)</Field.Label>
                <Input type="url" value={url} onChange={(event) => setUrl(event.target.value)} />
              </Field.Root>
            </HStack>
            <Field.Root>
              <Field.Label>Required skills (optional)</Field.Label>
              <Input value={skillList} onChange={(event) => setSkillList(event.target.value)} />
              <Field.HelperText>
                Separate skills with commas, for example: react, typescript
              </Field.HelperText>
            </Field.Root>
            <Field.Root>
              <Field.Label>Notes (optional)</Field.Label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                maxLength={JOB_NOTES_MAX}
              />
            </Field.Root>
            {jobError && (
              <Text role="alert" color="fg.error" fontSize="sm">
                {jobError}
              </Text>
            )}
            <HStack>
              <Button
                type="submit"
                colorPalette="teal"
                loading={jobs.isBusy('new')}
                disabled={!jobs.loaded}
              >
                <LuPlus aria-hidden="true" focusable="false" />
                Save job
              </Button>
            </HStack>
          </VStack>
        </chakra.form>

        {jobs.error && !jobs.pending ? (
          <VStack align="start" gap={2}>
            <Text color="fg.error">{jobs.error}</Text>
            <Button size="sm" variant="outline" onClick={jobs.reload}>
              Retry loading jobs
            </Button>
          </VStack>
        ) : jobs.loaded && jobs.items.length === 0 ? (
          <Text color="fg.muted">No saved jobs yet.</Text>
        ) : (
          <Box as="ul" listStyleType="none" m={0} p={0}>
            {jobs.items.map((job) => {
              const id = getRecordId(job);
              const gap = getSkillGap(job, skills.items);
              const headingId = 'job-' + id;
              return (
                <Box as="li" key={id} py={3} borderTopWidth="1px" borderColor="border.muted">
                  <Heading as="h3" id={headingId} size="sm" overflowWrap="anywhere">
                    {job.title}
                  </Heading>
                  {job.company && (
                    <Text fontSize="sm" color="fg.muted" overflowWrap="anywhere">
                      {job.company}
                    </Text>
                  )}
                  {safeHttpsUrl(job.url) && (
                    <Link
                      href={safeHttpsUrl(job.url)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      fontSize="sm"
                      color="accent.teal"
                      aria-label={'Job posting for ' + job.title + ' (opens in a new tab)'}
                    >
                      Job posting
                      <LuExternalLink aria-hidden="true" focusable="false" />
                    </Link>
                  )}
                  {job.notes && (
                    <Text fontSize="sm" whiteSpace="pre-wrap" overflowWrap="anywhere" mt={1}>
                      {job.notes}
                    </Text>
                  )}
                  <HStack gap={2} mt={2} flexWrap="wrap">
                    <NativeSelect.Root size="xs" w="auto">
                      <NativeSelect.Field
                        aria-label={'Status for ' + job.title}
                        value={job.status}
                        onChange={async (event) => {
                          const next = event.target.value as JobStatus;
                          begin();
                          const message = await jobs.update(id, (current) =>
                            updateJob(current, id, { status: next }),
                          );
                          settle(message, job.title + ' is now ' + jobStatusLabel[next] + '.');
                        }}
                      >
                        {JOB_STATUSES.map((value) => (
                          <option key={value} value={value}>
                            {jobStatusLabel[value]}
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                    <ConfirmDeleteButton
                      name={job.title}
                      busy={jobs.isBusy(id)}
                      onConfirm={async () => {
                        begin();
                        const message = await jobs.remove(id, (current) => deleteJob(current, id));
                        settle(message, 'Deleted job: ' + job.title + '.', true);
                      }}
                    />
                  </HStack>
                  {job.requiredSkills.length > 0 && skills.loaded && (
                    <Box mt={3}>
                      <Text fontSize="sm">
                        <Text as="span" fontWeight="medium">
                          You have:
                        </Text>{' '}
                        {gap.have.length ? gap.have.join(', ') : 'none of the listed skills yet'}
                      </Text>
                      <Text fontSize="sm" fontWeight="medium" mt={1}>
                        {gap.missing.length
                          ? 'Missing: ' + gap.missing.length
                          : 'You have every listed skill.'}
                      </Text>
                      {gap.missing.length > 0 && (
                        <Box
                          as="ul"
                          listStyleType="none"
                          m={0}
                          p={0}
                          aria-label={'Missing skills for ' + job.title}
                        >
                          {gap.missing.map((skill) => {
                            const added = tasksLoaded && hasLearningTask(tasks, skill, job);
                            const key = id + ':' + skill;
                            return (
                              <HStack
                                as="li"
                                key={skill}
                                justify="space-between"
                                gap={3}
                                py={1.5}
                                flexWrap="wrap"
                              >
                                <Text fontSize="sm">{skill}</Text>
                                {added ? (
                                  <Text fontSize="xs" color="fg.muted">
                                    Learning task added
                                  </Text>
                                ) : (
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    disabled={!tasksLoaded || taskBusy.includes(key)}
                                    onClick={() => void addLearningTask(skill, job)}
                                    aria-label={'Add learning task: ' + skill + ' for ' + job.title}
                                  >
                                    Add learning task
                                  </Button>
                                )}
                              </HStack>
                            );
                          })}
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      <ApplicationsSection
        jobs={jobs.items}
        jobsLoaded={jobs.loaded}
        jobsFailed={!jobs.loaded && !!jobs.error && !jobs.pending}
        tasks={tasks}
        tasksLoaded={tasksLoaded}
        isBusy={(job) => taskBusy.includes('follow-up:' + getRecordId(job))}
        onFollowUp={(job) => void addFollowUpTask(job)}
      />

      <ResumeSection
        skills={skills.items}
        jobs={jobs.items}
        careerLoaded={skills.loaded && jobs.loaded}
      />
    </VStack>
  );
};

export default CareerPage;
