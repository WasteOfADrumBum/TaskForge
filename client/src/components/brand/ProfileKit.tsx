import { Button, Field, Stack, Textarea } from '@onesmall/ui';
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
import styles from './ProfileKit.module.css';

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
      <Stack gap={2} align="start">
        <p role="alert" className="os-text-danger os-m-0">
          {failure.replace(/\.$/, '')}. The profile kit needs your resume, skills and goals.
        </p>
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
      </Stack>
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
      <ul role="list" className="os-list-unstyled os-m-0">
        {specs.map((spec) => (
          <li key={spec.id} className="os-py-3 os-border-top">
            {'text' in spec.draft ? (
              <Stack gap={2}>
                <Field
                  label={spec.label}
                  hint={
                    spec.max
                      ? spec.draft.text.length +
                        ' of ' +
                        spec.max +
                        ' characters' +
                        (spec.draft.shortened
                          ? '. Shortened to fit; edit the source text for a complete version.'
                          : '')
                      : undefined
                  }
                >
                  <Textarea
                    value={spec.draft.text}
                    readOnly
                    rows={spec.rows}
                    className={spec.id === 'kit-readme' ? 'os-font-mono' : undefined}
                  />
                </Field>
                <div>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={(event: MouseEvent<HTMLButtonElement>) =>
                      void copy(event, spec, (spec.draft as { text: string }).text)
                    }
                    aria-label={'Copy ' + spec.label}
                    leftIcon={<LuCopy focusable="false" />}
                  >
                    Copy
                  </Button>
                </div>
              </Stack>
            ) : (
              <p className="os-text-sm os-m-0">
                <span className="os-font-semibold">{spec.label}:</span> {spec.draft.missing}
              </p>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section aria-labelledby="profile-kit-heading" className="tf-panel os-p-4 md:os-p-5">
      <h2 id="profile-kit-heading" className="tf-h3 os-mt-0 os-mb-1">
        Profile kit
      </h2>
      <p className="os-text-sm os-text-muted os-m-0">
        Drafts for LinkedIn and GitHub built from your personal brand, resume, skills and career
        goals. Rule-based: nothing is made up, and nothing is posted for you.
      </p>
      <p
        role="status"
        aria-live="polite"
        className={`os-text-sm os-text-muted os-mt-1 os-mb-0 ${styles.status}`}
      >
        {status || (!loaded && !failure ? 'Loading your profile data...' : '')}
      </p>
      {body}
    </section>
  );
};

export default ProfileKit;
