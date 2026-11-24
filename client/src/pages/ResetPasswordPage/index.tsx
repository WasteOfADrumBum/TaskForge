import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Field, Input, Stack } from '@onesmall/ui';
import { useNavigate } from 'react-router-dom';
import TextLink from '../../components/auth/TextLink';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { resetPassword } from '../../api/auth';
import AuthPageFrame from '../../components/auth/AuthPageFrame';
import styles from '../../components/auth/AuthPage.module.css';
import { LinkButton } from '../../components/ui/links';
import { toaster } from '../../components/ui/toaster';
import { getRegistrationPasswordError, REGISTRATION_PASSWORD_HELP } from '../../utils/authInput';

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

// The link carries the token in the fragment (#token=...), which browsers never send to a server.
const readTokenFromHash = (): string | null => {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = params.get('token');
  return token && TOKEN_PATTERN.test(token) ? token : null;
};

const ResetPasswordPage = () => {
  const [token, setToken] = useState(readTokenFromHash);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const passwordInput = useRef<HTMLInputElement>(null);
  const confirmInput = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const navigate = useNavigate();
  useDocumentTitle(token ? 'Choose a new password · TaskForge' : 'Reset link problem · TaskForge');

  useEffect(() => {
    // Drop the token from the address bar and history once it is in memory.
    const takeTokenFromHash = () => {
      if (!window.location.hash) return;
      const fromHash = readTokenFromHash();
      if (fromHash) setToken(fromHash);
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search,
      );
    };
    takeTokenFromHash();
    // A link pasted into this same tab changes only the fragment and does not remount the page.
    window.addEventListener('hashchange', takeTokenFromHash);
    return () => {
      window.removeEventListener('hashchange', takeTokenFromHash);
      controller.current?.abort();
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current || !token) return;
    const policyError = getRegistrationPasswordError(password);
    setPasswordError(policyError);
    if (policyError) {
      passwordInput.current?.focus();
      return;
    }
    if (confirm !== password) {
      setConfirmError('The two passwords do not match.');
      confirmInput.current?.focus();
      return;
    }
    inFlight.current = true;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setPending(true);
    setRequestError(null);
    try {
      const data = await resetPassword(token, password, current.signal);
      if (current.signal.aborted) return;
      toaster.create({ title: 'Password updated', description: data.message, type: 'success' });
      navigate('/login', { replace: true });
    } catch (error) {
      if (current.signal.aborted) return;
      setRequestError(error instanceof Error ? error.message : 'Unable to reset your password');
    } finally {
      if (!current.signal.aborted) {
        inFlight.current = false;
        setPending(false);
      }
    }
  };

  if (!token) {
    return (
      <AuthPageFrame>
        <Stack gap={6} className={styles.card}>
          <h1 className="tf-h1 os-m-0">This reset link does not work</h1>
          <p className="os-text-muted os-m-0">
            The link is incomplete, or this page was reloaded after opening it. Reset links work
            once and expire after 30 minutes.
          </p>
          <LinkButton to="/forgot-password" size="lg">
            Ask for a new link
          </LinkButton>
        </Stack>
      </AuthPageFrame>
    );
  }

  return (
    <AuthPageFrame>
      <form onSubmit={handleSubmit} className={styles.card}>
        <Stack gap={6}>
          <div>
            <h1 className="tf-h1 os-m-0">Choose a new password</h1>
            <p className="os-text-muted os-mt-2 os-mb-0">
              After you save it, sign in with the new password.
            </p>
          </div>
          <Field
            label="New password"
            required
            hint={REGISTRATION_PASSWORD_HELP}
            error={passwordError ?? undefined}
          >
            <Input
              ref={passwordInput}
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordError(null);
              }}
              size="lg"
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password" required error={confirmError ?? undefined}>
            <Input
              ref={confirmInput}
              type="password"
              value={confirm}
              onChange={(event) => {
                setConfirm(event.target.value);
                setConfirmError(null);
              }}
              size="lg"
              autoComplete="new-password"
            />
          </Field>
          {/* The screen-reader alert stays mounted (and empty) so text placed in it is announced;
              the visible copy is hidden from assistive tech to avoid a repeat. */}
          <p className="os-sr-only" role="alert">
            {requestError ?? ''}
          </p>
          {requestError && (
            <Stack gap={2}>
              <p aria-hidden="true" className="os-text-danger os-m-0">
                {requestError}
              </p>
              <TextLink to="/forgot-password">Ask for a new reset link</TextLink>
            </Stack>
          )}
          {/* aria-disabled instead of disabled keeps keyboard focus on the button while saving. */}
          <Button type="submit" size="lg" fullWidth aria-disabled={pending || undefined}>
            {pending ? 'Saving new password…' : 'Save new password'}
          </Button>
        </Stack>
      </form>
    </AuthPageFrame>
  );
};

export default ResetPasswordPage;
