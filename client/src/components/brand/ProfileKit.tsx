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
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [status, setStatus] = useState('');

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
        setResumeError(failure instanceof Error ? failure.message : 'Unable to load your resume');
      });
    return () => controller.abort();
  }, [token, sessionVersion]);

  const resumeLoaded = resume?.key === sessionKey;
  const loaded = brandsLoaded && resumeLoaded && skills.loaded && goals.loaded;
  const failure = resumeError ?? skills.error ?? goals.error;

  const copy = async (event: MouseEvent<HTMLButtonElement>, spec: DraftSpec, text: string) => {
    const area = event.currentTarget.closest('li')?.querySelector('textarea');
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied the ' + spec.label + '.');
    } catch {
      // Without clipboard access, select the text so a keyboard copy takes it.
      area?.focus();
      area?.select();
      setStatus(
        'Could not copy automatically. The ' +
          spec.label +
          ' is selected; press Control+C or Command+C to copy it.',
      );
    }
  };

  let body;
  if (failure && !loaded) {
    body = (
      <Text role="alert" color="fg.error">
        {failure}. The profile kit needs your resume, skills and goals.
      </Text>
    );
  } else if (!loaded) {
    body = <Text color="fg.muted">Loading your profile data...</Text>;
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
              <>
                <Heading as="h3" size="sm">
                  {spec.label}
                </Heading>
                <Text fontSize="sm" color="fg.muted">
                  {spec.draft.missing}
                </Text>
              </>
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
        {status}
      </Text>
      {body}
    </Box>
  );
};

export default ProfileKit;
