import {
  Box,
  Button,
  chakra,
  Field,
  Heading,
  Input,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { LuSave } from 'react-icons/lu';
import { isCurrentSession } from '../../api/authenticatedFetch';
import { getResume, saveResume } from '../../api/resume';
import { useDelayedRequest } from '../../hooks/useDelayedRequest';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import type { SavedJob, Skill } from '../../types/career';
import { RESUME_BODY_MAX, RESUME_HEADLINE_MAX, RESUME_SUMMARY_MAX } from '../../types/resume';
import { getResumeSkillCheck } from '../../utils/resume';
import { SessionExpiredError } from '../../utils/session';

const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const left = (max: number, value: string) => {
  const count = max - value.length;
  return count + (count === 1 ? ' character' : ' characters') + ' left';
};

const SkillList = ({ id, title, items }: { id: string; title: string; items: string[] }) => (
  <Box mt={3}>
    <Heading as="h4" id={id} size="sm" mb={1}>
      {title}
    </Heading>
    <Box as="ul" role="list" listStyleType="none" m={0} p={0} aria-labelledby={id}>
      {items.map((item) => (
        <Box as="li" key={item} py={1} borderTopWidth="1px" borderColor="border.muted">
          <Text overflowWrap="anywhere">{item}</Text>
        </Box>
      ))}
    </Box>
  </Box>
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
    void saveResume(token, { headline, summary, body }, request.signal)
      .then((resume) => {
        if (!request.isCurrent() || !isCurrentSession(token, sessionVersion)) return;
        // Keep what is on screen: edits made while saving must not be overwritten.
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

  let status = '';
  if (read.pending)
    status = read.waiting ? 'Still loading your resume...' : 'Loading your resume...';
  else if (write.pending) status = write.waiting ? 'Still saving...' : 'Saving your resume...';
  else if (loadError) status = 'Your resume could not be loaded.';
  else if (saveError) status = 'Your resume was not saved.';
  else if (loaded && savedAt) status = 'Saved at ' + timeFormat.format(new Date(savedAt)) + '.';

  return (
    <Box
      as="section"
      aria-labelledby="resume-heading"
      bg="bg.panel"
      borderWidth="1px"
      borderRadius="lg"
      p={{ base: 4, md: 5 }}
    >
      <Heading as="h2" id="resume-heading" size="md" mb={1}>
        Resume
      </Heading>
      <Text fontSize="sm" color="fg.muted">
        Plain text, kept private to your account.
      </Text>
      <Text role="status" aria-live="polite" fontSize="sm" color="fg.muted" mt={1}>
        {status}
      </Text>
      {loadError && !read.pending ? (
        <VStack align="start" gap={2} mt={2}>
          <Text role="alert" color="fg.error">
            {loadError}
          </Text>
          <Button size="sm" variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            Retry loading resume
          </Button>
        </VStack>
      ) : loaded ? (
        <>
          <chakra.form onSubmit={onSubmit} noValidate aria-label="Edit resume" mt={3}>
            <VStack align="stretch" gap={4}>
              <Field.Root>
                <Field.Label>Headline</Field.Label>
                <Input
                  value={headline}
                  onChange={(event) => {
                    setSaveError(null);
                    setHeadline(event.target.value);
                  }}
                  maxLength={RESUME_HEADLINE_MAX}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>Summary</Field.Label>
                <Textarea
                  value={summary}
                  onChange={(event) => {
                    setSaveError(null);
                    setSummary(event.target.value);
                  }}
                  rows={3}
                  maxLength={RESUME_SUMMARY_MAX}
                />
                <Field.HelperText>{left(RESUME_SUMMARY_MAX, summary)}</Field.HelperText>
              </Field.Root>
              <Field.Root>
                <Field.Label>Experience, education and the rest</Field.Label>
                <Textarea
                  value={body}
                  onChange={(event) => {
                    setSaveError(null);
                    setBody(event.target.value);
                  }}
                  rows={10}
                  maxLength={RESUME_BODY_MAX}
                />
                <Field.HelperText>{left(RESUME_BODY_MAX, body)}</Field.HelperText>
              </Field.Root>
              {saveError && (
                <Text role="alert" color="fg.error">
                  {saveError}
                </Text>
              )}
              <Box>
                <Button type="submit" colorPalette="teal" loading={write.pending}>
                  <LuSave aria-hidden="true" focusable="false" />
                  Save resume
                </Button>
              </Box>
            </VStack>
          </chakra.form>

          <Box mt={6}>
            <Heading as="h3" size="sm">
              Skill check
            </Heading>
            <Text fontSize="sm" color="fg.muted">
              Compares the text above with your skills and saved jobs by whole word. Rule-based.
            </Text>
            {!careerLoaded ? (
              <Text color="fg.muted" mt={2}>
                Waiting for your skills and saved jobs...
              </Text>
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
                  <Text color="fg.muted" mt={2}>
                    Add skills and saved jobs above to check your resume against them.
                  </Text>
                )}
              </>
            )}
          </Box>
        </>
      ) : null}
    </Box>
  );
};

export default ResumeSection;
