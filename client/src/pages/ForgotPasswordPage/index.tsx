import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Box, Button, chakra, Field, Heading, Input, Text, VStack } from '@chakra-ui/react';
import { requestPasswordReset } from '../../api/auth';
import AuthPageFrame from '../../components/auth/AuthPageFrame';
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
      <chakra.form
        onSubmit={handleSubmit}
        bg="bg.panel"
        borderWidth="1px"
        borderRadius="2xl"
        p={{ base: 6, md: 8 }}
        boxShadow="sm"
      >
        <VStack align="stretch" gap={6}>
          <Box>
            <Heading as="h1" size="2xl">
              Reset your password
            </Heading>
            <Text color="fg.muted" mt={2}>
              Enter the email you sign in with. If it matches an account, we will email a link to
              choose a new password.
            </Text>
          </Box>
          <Field.Root required>
            <Field.Label>Email</Field.Label>
            <Input
              type="email"
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              size="lg"
              autoComplete="email"
            />
          </Field.Root>
          {/* Screen-reader live regions stay mounted (and empty) so text placed in them is
              announced; the visible copy below is hidden from assistive tech to avoid repeats. */}
          <Text srOnly role="status" aria-live="polite">
            {outcome?.kind === 'sent' ? outcome.message : ''}
          </Text>
          <Text srOnly role="alert">
            {outcome?.kind === 'error' ? outcome.message : ''}
          </Text>
          {outcome && (
            <Text aria-hidden="true" color={outcome.kind === 'error' ? 'red.fg' : 'fg'}>
              {outcome.message}
            </Text>
          )}
          {/* aria-disabled instead of disabled keeps keyboard focus on the button while sending. */}
          <Button type="submit" size="lg" width="full" aria-disabled={pending || undefined}>
            {pending ? 'Sending reset link…' : 'Send reset link'}
          </Button>
          <Text textAlign="center" color="fg.muted">
            Remembered it? <TextLink to="/login">Back to sign in</TextLink>
          </Text>
        </VStack>
      </chakra.form>
    </AuthPageFrame>
  );
};

export default ForgotPasswordPage;
