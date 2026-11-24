import { Button, Field, Input, Stack, Textarea } from '@onesmall/ui';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { LuSave } from 'react-icons/lu';
import { isCurrentSession } from '../../api/authenticatedFetch';
import { getResume, saveResume } from '../../api/resume';
import { useDelayedRequest } from '../../hooks/useDelayedRequest';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import type { SavedJob, Skill } from '../../types/career';
import { RESUME_BODY_MAX, RESUME_HEADLINE_MAX, RESUME_SUMMARY_MAX } from '../../types/resume';
import { getResumeSkillCheck } from '../../utils/resume';
import { SessionExpiredError } from '../../utils/session';
import styles from './Career.module.css';

const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const left = (max: number, value: string) => {
  const count = max - value.length;
  return count + (count === 1 ? ' character' : ' characters') + ' left';
};

const SkillList = ({ id, title, items }: { id: string; title: string; items: string[] }) => (
  <div className="os-mt-3">
    <h4 id={id} className="tf-h3 os-m-0 os-mb-1">
      {title}
    </h4>
    <ul role="list" className="os-list-unstyled os-m-0 os-p-0" aria-labelledby={id}>
      {items.map((item) => (
        <li key={item} className="os-py-1 os-border-top">
          <p className={`os-m-0 os-max-w-none ${styles.wrap}`}>{item}</p>
        </li>
      ))}
    </ul>
  </div>
);

// The user's plain-text resume, with a rule-based check of which skills it mentions.
const ResumeSection = ({
  skills,
  jobs,
  careerLoaded,
}: {
  skills: Skill[];
  jobs: SavedJob[];
  careerLoaded: boolean;
}) => {
  const token = useAppSelector((state) => state.auth.token);
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  const sessionKey = token + ':' + sessionVersion;
  // The session the form was filled for, so a new sign-in never shows the last user's resume.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loaded = loadedFor === sessionKey;
  const [headline, setHeadline] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // The text last loaded or saved, so the status line never calls newer edits saved.
  const [saved, setSaved] = useState({ headline: '', summary: '', body: '' });
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const read = useDelayedRequest();
  const write = useDelayedRequest();
  const { begin } = read;

  useEffect(() => {
    if (!token || !isCurrentSession(token, sessionVersion)) return;
    const request = begin();
    if (!request) return;
    void getResume(token, request.signal)
      .then((resume) => {
        if (!request.isCurrent() || !isCurrentSession(token, sessionVersion)) return;
        setHeadline(resume?.headline ?? '');
        setSummary(resume?.summary ?? '');
        setBody(resume?.body ?? '');
        setSavedAt(resume?.updatedAt ?? null);
        setSaved({
          headline: resume?.headline ?? '',
          summary: resume?.summary ?? '',
          body: resume?.body ?? '',
        });
        setLoadError(null);
        setLoadedFor(token + ':' + sessionVersion);
      })
      .catch((failure: unknown) => {
        if (
          !request.isCurrent() ||
          !isCurrentSession(token, sessionVersion) ||
          failure instanceof SessionExpiredError
        )
          return;
        setLoadError(failure instanceof Error ? failure.message : 'Unable to load your resume');
      })
      .finally(request.finish);
    return request.cancel;
  }, [token, sessionVersion, reloadKey, begin]);

  const text = headline + '\n' + summary + '\n' + body;
  const check = useMemo(() => getResumeSkillCheck(text, skills, jobs), [text, skills, jobs]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!token || !isCurrentSession(token, sessionVersion)) return;
    const request = write.begin();
    if (!request) return;
    setSaveError(null);
    const sent = { headline, summary, body };
    void saveResume(token, sent, request.signal)
      .then((resume) => {
        if (!request.isCurrent() || !isCurrentSession(token, sessionVersion)) return;
        // Keep what is on screen: edits made while saving must not be overwritten.
        setSaved({ headline: resume.headline, summary: resume.summary, body: resume.body });
        setSavedAt(resume.updatedAt ?? new Date().toISOString());
      })
      .catch((failure: unknown) => {
        if (
          !request.isCurrent() ||
          !isCurrentSession(token, sessionVersion) ||
          failure instanceof SessionExpiredError
        )
          return;
        setSaveError(failure instanceof Error ? failure.message : 'Unable to save your resume');
      })
      .finally(request.finish);
  };

  // The server trims the headline and summary, so compare trimmed text.
  const dirty =
    headline.trim() !== saved.headline || summary.trim() !== saved.summary || body !== saved.body;
  // Errors are announced by their alerts, so the status line stays quiet then.
  let status = '';
  if (read.pending)
    status = read.waiting ? 'Still loading your resume...' : 'Loading your resume...';
  else if (write.pending) status = write.waiting ? 'Still saving...' : 'Saving your resume...';
  else if (loadError || saveError) status = '';
  else if (loaded && dirty) status = 'Unsaved changes.';
  else if (loaded && savedAt) status = 'Saved at ' + timeFormat.format(new Date(savedAt)) + '.';

  return (
    <section aria-labelledby="resume-heading" className="tf-panel os-p-4 md:os-p-5">
      <h2 id="resume-heading" className="tf-h2 os-m-0 os-mb-1">
        Resume
      </h2>
      <p className="os-text-sm os-text-muted os-m-0">Plain text, kept private to your account.</p>
      <p
        ref={statusRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="os-text-sm os-text-muted os-m-0 os-mt-1"
      >
        {status}
      </p>
      {loadError && !read.pending ? (
        <Stack gap={2} align="flex-start" className="os-mt-2">
          <p role="alert" className="os-text-danger os-m-0">
            {loadError}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setReloadKey((key) => key + 1);
              // The button leaves the page while loading, so focus moves to the status line.
              statusRef.current?.focus();
            }}
          >
            Retry loading resume
          </Button>
        </Stack>
      ) : loaded ? (
        <>
          <form onSubmit={onSubmit} noValidate aria-label="Edit resume" className="os-mt-3">
            <Stack gap={4}>
              <Field label="Headline" hint={left(RESUME_HEADLINE_MAX, headline)}>
                <Input
                  value={headline}
                  onChange={(event) => {
                    setSaveError(null);
                    setHeadline(event.target.value);
                  }}
                  maxLength={RESUME_HEADLINE_MAX}
                />
              </Field>
              <Field label="Summary" hint={left(RESUME_SUMMARY_MAX, summary)}>
                <Textarea
                  value={summary}
                  onChange={(event) => {
                    setSaveError(null);
                    setSummary(event.target.value);
                  }}
                  rows={3}
                  maxLength={RESUME_SUMMARY_MAX}
                />
              </Field>
              <Field label="Experience, education and the rest" hint={left(RESUME_BODY_MAX, body)}>
                <Textarea
                  value={body}
                  onChange={(event) => {
                    setSaveError(null);
                    setBody(event.target.value);
                  }}
                  rows={10}
                  maxLength={RESUME_BODY_MAX}
                />
              </Field>
              {saveError && (
                <p role="alert" className="os-text-danger os-m-0">
                  {saveError}
                </p>
              )}
              <div>
                <Button
                  type="submit"
                  loading={write.pending}
                  leftIcon={<LuSave aria-hidden="true" focusable="false" />}
                >
                  Save resume
                </Button>
              </div>
            </Stack>
          </form>

          <div className="os-mt-6">
            <h3 className="tf-h3 os-m-0">Skill check</h3>
            <p className="os-text-sm os-text-muted os-m-0">
              Compares the text above with your skills and saved jobs by whole word. Rule-based.
            </p>
            {!careerLoaded ? (
              <p className="os-text-muted os-m-0 os-mt-2">
                Waiting for your skills and saved jobs...
              </p>
            ) : (
              <>
                {check.mentioned.length > 0 && (
                  <SkillList
                    id="resume-mentioned"
                    title={'Your skills it mentions: ' + check.mentioned.length}
                    items={check.mentioned}
                  />
                )}
                {check.notMentioned.length > 0 && (
                  <SkillList
                    id="resume-missing"
                    title={'Your skills it does not mention: ' + check.notMentioned.length}
                    items={check.notMentioned}
                  />
                )}
                {check.jobNeeds.length > 0 && (
                  <SkillList
                    id="resume-job-needs"
                    title="Skills your open saved jobs need that it does not mention"
                    items={check.jobNeeds.map(
                      (need) =>
                        need.skill +
                        ': needed by ' +
                        need.jobs +
                        (need.jobs === 1 ? ' job' : ' jobs'),
                    )}
                  />
                )}
                {skills.length === 0 && check.jobNeeds.length === 0 && (
                  <p className="os-text-muted os-m-0 os-mt-2">
                    Add skills and saved jobs above to check your resume against them.
                  </p>
                )}
              </>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
};

export default ResumeSection;
