import { useRef, useState, type FormEvent } from 'react';
import { Box, Button, chakra, Field, Heading, HStack, Input, Text, VStack } from '@chakra-ui/react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../../api/auth';
import Brand from '../../components/layout/Brand';
import { getRegistrationPasswordError, REGISTRATION_PASSWORD_HELP } from '../../utils/authInput';
import { toaster } from '../../components/ui/toaster';
import { useAppDispatch, useAppSelector } from '../../redux/hooks/typedHooks';
import { setError, setLoading } from '../../redux/slices/authSlice';

const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const loading = useAppSelector((state) => state.auth.loading);

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = getRegistrationPasswordError(password);
    setPasswordError(validationError);
    if (validationError) {
      passwordInput.current?.focus();
      return;
    }
    dispatch(setLoading(true));
    dispatch(setError(null));

    try {
      await register({ email, password });
      toaster.create({
        title: 'Account created',
        description: 'Your workspace is ready. Sign in to continue.',
        type: 'success',
      });
      navigate('/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to register';
      dispatch(setError(message));
      toaster.create({ title: 'Registration failed', description: message, type: 'error' });
    } finally {
      dispatch(setLoading(false));
    }
  };

  return (
    <Box minH="100vh" bg="bg.subtle">
      <HStack maxW="7xl" mx="auto" px={{ base: 4, md: 6 }} py={5} justify="space-between">
        <Brand compact />
        <Button asChild variant="ghost">
          <Link to="/login">Sign in</Link>
        </Button>
      </HStack>
      <Box maxW="md" mx="auto" px={4} py={{ base: 10, md: 20 }}>
        <chakra.form
          onSubmit={handleRegister}
          bg="bg.panel"
          borderWidth="1px"
          borderRadius="2xl"
          p={{ base: 6, md: 8 }}
          boxShadow="sm"
        >
          <VStack align="stretch" gap={6}>
            <Box>
              <Heading size="2xl">Create your workspace</Heading>
              <Text color="fg.muted" mt={2}>
                Start organizing tasks, priorities, due dates, and progress.
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
            <Field.Root required invalid={Boolean(passwordError)}>
              <Field.Label>Password</Field.Label>
              <Input
                ref={passwordInput}
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setPasswordError(null);
                }}
                placeholder="Create a password"
                size="lg"
                autoComplete="new-password"
              />
              <Field.HelperText fontSize="xs">{REGISTRATION_PASSWORD_HELP}</Field.HelperText>
              <Field.ErrorText fontSize="xs">{passwordError}</Field.ErrorText>
            </Field.Root>
            <Button type="submit" size="lg" width="full" loading={loading}>
              Create account
            </Button>
            <Text textAlign="center" color="fg.muted">
              Already have an account? <Link to="/login">Sign in</Link>
            </Text>
          </VStack>
        </chakra.form>
      </Box>
    </Box>
  );
};

export default RegisterPage;
