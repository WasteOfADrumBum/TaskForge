import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Box, Button, chakra, Field, Heading, Input, Text, VStack } from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../../api/auth';
import AuthPageFrame from '../../components/auth/AuthPageFrame';

type Outcome = { kind: 'sent' | 'error'; message: string } | null;

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
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
      if (!current.signal.aborted) setPending(false);
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
          {outcome?.kind === 'sent' && (
            <Text role="status" aria-live="polite" color="fg">
              {outcome.message}
            </Text>
          )}
          {outcome?.kind === 'error' && (
            <Text role="alert" color="red.fg">
              {outcome.message}
            </Text>
          )}
          <Button type="submit" size="lg" width="full" loading={pending}>
            Send reset link
          </Button>
          <Text textAlign="center" color="fg.muted">
            Remembered it? <Link to="/login">Back to sign in</Link>
          </Text>
        </VStack>
      </chakra.form>
    </AuthPageFrame>
  );
};

export default ForgotPasswordPage;
