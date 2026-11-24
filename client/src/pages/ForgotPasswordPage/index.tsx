import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Field, Input, Stack } from '@onesmall/ui';
import { requestPasswordReset } from '../../api/auth';
import AuthPageFrame from '../../components/auth/AuthPageFrame';
import styles from '../../components/auth/AuthPage.module.css';
import TextLink from '../../components/auth/TextLink';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

type Outcome = { kind: 'sent' | 'error'; message: string } | null;

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  useDocumentTitle('Reset your password · TaskForge');
  useEffect(() => () => controller.current?.abort(), []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setPending(true);
    setOutcome(null);
    try {
      const data = await requestPasswordReset(email, current.signal);
      if (current.signal.aborted) return;
      setOutcome({ kind: 'sent', message: data.message });
    } catch (error) {
      if (current.signal.aborted) return;
      setOutcome({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to request a reset link',
      });
    } finally {
      if (!current.signal.aborted) {
        inFlight.current = false;
        setPending(false);
      }
    }
  };

  return (
    <AuthPageFrame>
      <form onSubmit={handleSubmit} className={styles.card}>
        <Stack gap={6}>
          <div>
            <h1 className="tf-h1 os-m-0">Reset your password</h1>
            <p className="os-text-muted os-mt-2 os-mb-0">
              Enter the email you sign in with. If it matches an account, we will email a link to
              choose a new password.
            </p>
          </div>
          <Field label="Email" required>
            <Input
              type="email"
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              size="lg"
              autoComplete="email"
            />
          </Field>
          {/* Screen-reader live regions stay mounted (and empty) so text placed in them is
              announced; the visible copy below is hidden from assistive tech to avoid repeats. */}
          <p className="os-sr-only" role="status" aria-live="polite">
            {outcome?.kind === 'sent' ? outcome.message : ''}
          </p>
          <p className="os-sr-only" role="alert">
            {outcome?.kind === 'error' ? outcome.message : ''}
          </p>
          {outcome && (
            <p
              aria-hidden="true"
              className={outcome.kind === 'error' ? 'os-text-danger os-m-0' : 'os-m-0'}
            >
              {outcome.message}
            </p>
          )}
          {/* aria-disabled instead of disabled keeps keyboard focus on the button while sending. */}
          <Button type="submit" size="lg" fullWidth aria-disabled={pending || undefined}>
            {pending ? 'Sending reset link…' : 'Send reset link'}
          </Button>
          <p className="os-text-center os-text-muted os-m-0 os-max-w-none">
            Remembered it? <TextLink to="/login">Back to sign in</TextLink>
          </p>
        </Stack>
      </form>
    </AuthPageFrame>
  );
};

export default ForgotPasswordPage;
