import { Box, Button, Field, Heading, Text, Textarea, VStack } from '@chakra-ui/react';
import { useEffect, useState, type MouseEvent } from 'react';
import { LuCopy } from 'react-icons/lu';
import { isCurrentSession } from '../../api/authenticatedFetch';
import { getSkills } from '../../api/career';
import { getResume } from '../../api/resume';
import { useGoals } from '../../hooks/useGoals';
import { useOwnedList } from '../../hooks/useOwnedList';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import type { BrandProfile } from '../../types/brand';
import type { Skill } from '../../types/career';
import type { Resume } from '../../types/resume';
import {
  githubReadme,
  LINKEDIN_ABOUT_MAX,
  LINKEDIN_HEADLINE_MAX,
  linkedinAbout,
  linkedinHeadline,
  type Draft,
} from '../../utils/profileKit';
import { SessionExpiredError } from '../../utils/session';

interface DraftSpec {
  id: string;
  label: string;
  draft: Draft;
  max?: number;
  rows: number;
}

// Copy-ready LinkedIn and GitHub drafts from data already saved. Rule-based; nothing is sent or
// posted anywhere.
const ProfileKit = ({ brand, brandsLoaded }: { brand?: BrandProfile; brandsLoaded: boolean }) => {
  const token = useAppSelector((state) => state.auth.token);
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  const sessionKey = token + ':' + sessionVersion;
  const skills = useOwnedList<Skill>(getSkills, 'Unable to load skills');
  const goals = useGoals();
  const [resume, setResume] = useState<{ key: string; value: Resume | null } | null>(null);
  // Kept with the session it happened in, so a new sign-in never shows the last user's error.
  const [resumeFailure, setResumeError] = useState<{ key: string; message: string } | null>(null);
  const resumeError = resumeFailure?.key === sessionKey ? resumeFailure.message : null;
  const [status, setStatus] = useState('');
  const [resumeReload, setResumeReload] = useState(0);
  // Cleared first, so repeating the same message is announced again.
  const announce = (message: string) => {
    setStatus('');
    requestAnimationFrame(() => setStatus(message));
  };

  useEffect(() => {
    if (!token || !isCurrentSession(token, sessionVersion)) return;
    const controller = new AbortController();
    void getResume(token, controller.signal)
      .then((value) => {
        if (controller.signal.aborted || !isCurrentSession(token, sessionVersion)) return;
        setResume({ key: token + ':' + sessionVersion, value });
        setResumeError(null);
      })
      .catch((failure: unknown) => {
        if (
          controller.signal.aborted ||
          !isCurrentSession(token, sessionVersion) ||
          failure instanceof SessionExpiredError
        )
          return;
        setResumeError({
          key: token + ':' + sessionVersion,
          message: failure instanceof Error ? failure.message : 'Unable to load your resume',
        });
      });
    return () => controller.abort();
  }, [token, sessionVersion, resumeReload]);

  const resumeLoaded = resume?.key === sessionKey;
  const loaded = brandsLoaded && resumeLoaded && skills.loaded && goals.loaded;
  const failure = resumeError ?? skills.error ?? goals.error;

  const copy = async (event: MouseEvent<HTMLButtonElement>, spec: DraftSpec, text: string) => {
    const area = event.currentTarget.closest('li')?.querySelector('textarea');
    try {
      // navigator.clipboard is missing outside secure contexts; that lands in the catch too.
      await navigator.clipboard.writeText(text);
      announce('Copied the ' + spec.label + '.');
    } catch {
      // Without clipboard access, select the text so a keyboard copy takes it.
      area?.focus();
      area?.select();
      area?.setSelectionRange(0, text.length);
      announce(
        'Could not copy automatically. The ' +
          spec.label +
          ' is selected; press Control+C or Command+C to copy it.',
      );
    }
  };

  let body;
  if (failure && !loaded) {
    body = (
      <VStack align="start" gap={2}>
        <Text role="alert" color="fg.error">
          {failure.replace(/\.$/, '')}. The profile kit needs your resume, skills and goals.
        </Text>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (resumeError) {
              setResumeError(null);
              setResumeReload((key) => key + 1);
            }
            if (skills.error) skills.reload();
            if (goals.error) goals.reload();
          }}
        >
          Retry loading profile data
        </Button>
      </VStack>
    );
  } else if (!loaded) {
    body = null;
  } else {
    const input = { brand, resume: resume.value, skills: skills.items, goals: goals.goals };
    const specs: DraftSpec[] = [
      {
        id: 'kit-headline',
        label: 'LinkedIn headline',
        draft: linkedinHeadline(input),
        max: LINKEDIN_HEADLINE_MAX,
        rows: 2,
      },
      {
        id: 'kit-about',
        label: 'LinkedIn About section',
        draft: linkedinAbout(input),
        max: LINKEDIN_ABOUT_MAX,
        rows: 6,
      },
      { id: 'kit-readme', label: 'GitHub profile README', draft: githubReadme(input), rows: 10 },
    ];
    body = (
      <Box as="ul" role="list" listStyleType="none" m={0} p={0}>
        {specs.map((spec) => (
          <Box as="li" key={spec.id} py={3} borderTopWidth="1px" borderColor="border.muted">
            {'text' in spec.draft ? (
              <VStack align="stretch" gap={2}>
                <Field.Root>
                  <Field.Label>{spec.label}</Field.Label>
                  <Textarea
                    value={spec.draft.text}
                    readOnly
                    rows={spec.rows}
                    fontFamily={spec.id === 'kit-readme' ? 'mono' : undefined}
                  />
                  {spec.max && (
                    <Field.HelperText>
                      {spec.draft.text.length} of {spec.max} characters
                      {spec.draft.shortened
                        ? '. Shortened to fit; edit the source text for a complete version.'
                        : ''}
                    </Field.HelperText>
                  )}
                </Field.Root>
                <Box>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={(event) =>
                      void copy(event, spec, (spec.draft as { text: string }).text)
                    }
                    aria-label={'Copy ' + spec.label}
                  >
                    <LuCopy aria-hidden="true" focusable="false" />
                    Copy
                  </Button>
                </Box>
              </VStack>
            ) : (
              <Text fontSize="sm">
                <Text as="span" fontWeight="semibold">
                  {spec.label}:
                </Text>{' '}
                {spec.draft.missing}
              </Text>
            )}
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box
      as="section"
      aria-labelledby="profile-kit-heading"
      bg="bg.panel"
      borderWidth="1px"
      borderRadius="lg"
      p={{ base: 4, md: 5 }}
    >
      <Heading as="h2" id="profile-kit-heading" size="md" mb={1}>
        Profile kit
      </Heading>
      <Text fontSize="sm" color="fg.muted">
        Drafts for LinkedIn and GitHub built from your personal brand, resume, skills and career
        goals. Rule-based: nothing is made up, and nothing is posted for you.
      </Text>
      <Text role="status" aria-live="polite" fontSize="sm" color="fg.muted" mt={1} minH={5}>
        {status || (!loaded && !failure ? 'Loading your profile data...' : '')}
      </Text>
      {body}
    </Box>
  );
};

export default ProfileKit;
