import { Badge, Button, Field, Input, Select, Stack, Textarea } from '@onesmall/ui';
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
import styles from './Career.module.css';

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
    <Stack gap={{ base: 6, md: 8 }}>
      <div>
        <h1 className="tf-h1 os-m-0">Career</h1>
        <p className="os-text-muted os-m-0 os-mt-2">
          Your skills and the jobs you are looking at. Skill gaps compare a job&apos;s required
          skills with yours by exact name. They are rule-based, not AI.
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
        {actionError && (
          <p role="alert" className="os-text-danger os-m-0 os-mt-1">
            {actionError}
          </p>
        )}
      </div>

      <CareerGoals />

      <section aria-labelledby="skills-heading" className="tf-panel os-p-4 md:os-p-5">
        <h2 id="skills-heading" className="tf-h2 os-m-0 os-mb-4">
          Skills <Badge size="sm">{skills.items.length}</Badge>
        </h2>
        <form onSubmit={addSkill} aria-label="Add a skill" className="os-mb-4" noValidate>
          <div className="os-flex os-items-end os-gap-3 os-flex-wrap">
            <Field label="Skill" required className={styles.grow}>
              <Input
                value={skillName}
                onChange={(event) => setSkillName(event.target.value)}
                maxLength={SKILL_NAME_MAX}
                placeholder="For example, typescript"
                invalid={Boolean(skillError)}
              />
            </Field>
            <Field label="Level">
              <Select
                value={skillLevel}
                onChange={(event) => setSkillLevel(event.target.value as SkillLevel)}
              >
                {SKILL_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {skillLevelLabel[level]}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              type="submit"
              loading={skills.isBusy('new')}
              disabled={!skills.loaded}
              leftIcon={<LuPlus aria-hidden="true" focusable="false" />}
            >
              Add skill
            </Button>
          </div>
          {skillError && (
            <p role="alert" className="os-text-danger os-text-sm os-m-0 os-mt-2">
              {skillError}
            </p>
          )}
        </form>
        {skills.error && !skills.pending ? (
          <Stack gap={2} align="flex-start">
            <p className="os-text-danger os-m-0">{skills.error}</p>
            <Button size="sm" variant="outline" onClick={skills.reload}>
              Retry loading skills
            </Button>
          </Stack>
        ) : skills.loaded && skills.items.length === 0 ? (
          <p className="os-text-muted os-m-0">No skills yet. Add the ones you already use.</p>
        ) : (
          <ul className="os-list-unstyled os-m-0 os-p-0">
            {skills.items.map((skill) => {
              const id = getRecordId(skill);
              return (
                <li
                  key={id}
                  className="os-flex os-items-center os-justify-between os-gap-3 os-py-2 os-border-top os-flex-wrap"
                >
                  <p className={`os-font-medium os-m-0 ${styles.wrap}`}>{skill.name}</p>
                  <div className="os-flex os-items-center os-gap-2">
                    <Select
                      size="xs"
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
                    </Select>
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
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="jobs-heading" className="tf-panel os-p-4 md:os-p-5">
        <h2 id="jobs-heading" className="tf-h2 os-m-0 os-mb-4">
          Saved jobs <Badge size="sm">{jobs.items.length}</Badge>
        </h2>
        <form onSubmit={addJob} aria-label="Save a job" className="os-mb-4" noValidate>
          <Stack gap={3}>
            <Field label="Job title" required>
              <Input
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                maxLength={JOB_TITLE_MAX}
                invalid={jobError === 'Give the job a title.'}
              />
            </Field>
            <div className="os-flex os-items-start os-gap-3 os-flex-wrap">
              <Field label="Company (optional)" className={styles.grow}>
                <Input
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  maxLength={JOB_COMPANY_MAX}
                />
              </Field>
              <Field label="Link (optional, https)" className={styles.grow}>
                <Input type="url" value={url} onChange={(event) => setUrl(event.target.value)} />
              </Field>
            </div>
            <Field
              label="Required skills (optional)"
              hint="Separate skills with commas, for example: react, typescript"
            >
              <Input value={skillList} onChange={(event) => setSkillList(event.target.value)} />
            </Field>
            <Field label="Notes (optional)">
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                maxLength={JOB_NOTES_MAX}
              />
            </Field>
            {jobError && (
              <p role="alert" className="os-text-danger os-text-sm os-m-0">
                {jobError}
              </p>
            )}
            <div className="os-flex os-items-center">
              <Button
                type="submit"
                loading={jobs.isBusy('new')}
                disabled={!jobs.loaded}
                leftIcon={<LuPlus aria-hidden="true" focusable="false" />}
              >
                Save job
              </Button>
            </div>
          </Stack>
        </form>

        {jobs.error && !jobs.pending ? (
          <Stack gap={2} align="flex-start">
            <p className="os-text-danger os-m-0">{jobs.error}</p>
            <Button size="sm" variant="outline" onClick={jobs.reload}>
              Retry loading jobs
            </Button>
          </Stack>
        ) : jobs.loaded && jobs.items.length === 0 ? (
          <p className="os-text-muted os-m-0">No saved jobs yet.</p>
        ) : (
          <ul className="os-list-unstyled os-m-0 os-p-0">
            {jobs.items.map((job) => {
              const id = getRecordId(job);
              const gap = getSkillGap(job, skills.items);
              const headingId = 'job-' + id;
              return (
                <li key={id} className="os-py-3 os-border-top">
                  <h3 id={headingId} className={`tf-h3 os-m-0 ${styles.wrap}`}>
                    {job.title}
                  </h3>
                  {job.company && (
                    <p className={`os-text-sm os-text-muted os-m-0 ${styles.wrap}`}>
                      {job.company}
                    </p>
                  )}
                  {safeHttpsUrl(job.url) && (
                    <a
                      href={safeHttpsUrl(job.url)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`os-text-sm ${styles.iconLink}`}
                      aria-label={'Job posting for ' + job.title + ' (opens in a new tab)'}
                    >
                      Job posting
                      <LuExternalLink aria-hidden="true" focusable="false" />
                    </a>
                  )}
                  {job.notes && (
                    <p
                      className={`os-text-sm os-m-0 os-mt-1 os-max-w-none ${styles.wrap} ${styles.preWrap}`}
                    >
                      {job.notes}
                    </p>
                  )}
                  <div className="os-flex os-items-center os-gap-2 os-mt-2 os-flex-wrap">
                    <Select
                      size="xs"
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
                    </Select>
                    <ConfirmDeleteButton
                      name={job.title}
                      busy={jobs.isBusy(id)}
                      onConfirm={async () => {
                        begin();
                        const message = await jobs.remove(id, (current) => deleteJob(current, id));
                        settle(message, 'Deleted job: ' + job.title + '.', true);
                      }}
                    />
                  </div>
                  {job.requiredSkills.length > 0 && skills.loaded && (
                    <div className="os-mt-3">
                      <p className="os-text-sm os-m-0">
                        <span className="os-font-medium">You have:</span>{' '}
                        {gap.have.length ? gap.have.join(', ') : 'none of the listed skills yet'}
                      </p>
                      <p className="os-text-sm os-font-medium os-m-0 os-mt-1">
                        {gap.missing.length
                          ? 'Missing: ' + gap.missing.length
                          : 'You have every listed skill.'}
                      </p>
                      {gap.missing.length > 0 && (
                        <ul
                          className="os-list-unstyled os-m-0 os-p-0"
                          aria-label={'Missing skills for ' + job.title}
                        >
                          {gap.missing.map((skill) => {
                            const added = tasksLoaded && hasLearningTask(tasks, skill, job);
                            const key = id + ':' + skill;
                            return (
                              <li
                                key={skill}
                                className="os-flex os-items-center os-justify-between os-gap-3 os-py-1 os-flex-wrap"
                              >
                                <p className="os-text-sm os-m-0">{skill}</p>
                                {added ? (
                                  <p className="os-text-xs os-text-muted os-m-0">
                                    Learning task added
                                  </p>
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
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
    </Stack>
  );
};

export default CareerPage;
