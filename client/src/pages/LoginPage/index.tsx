import { useState, type FormEvent } from 'react';
import { Box, Button, chakra, Field, Heading, HStack, Input, Text, VStack } from '@chakra-ui/react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../../api/auth';
import Brand from '../../components/layout/Brand';
import { toaster } from '../../components/ui/toaster';
import { useAppDispatch, useAppSelector } from '../../redux/hooks/typedHooks';
import {
  SESSION_EXPIRED_MESSAGE,
  setError,
  setLoading,
  setToken,
} from '../../redux/slices/authSlice';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const loading = useAppSelector((state) => state.auth.loading);
  // Login and register failures are shown as toasts; only session expiry is shown inline.
  const sessionExpired = useAppSelector((state) => state.auth.error === SESSION_EXPIRED_MESSAGE);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    dispatch(setLoading(true));
    dispatch(setError(null));

    try {
      const data = await login({ email, password });
      localStorage.setItem('token', data.token);
      dispatch(setToken(data.token));
      toaster.create({
        title: 'Welcome back',
        description: 'You have logged in successfully.',
        type: 'success',
      });
      navigate('/home');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to log in';
      dispatch(setError(message));
      toaster.create({ title: 'Login failed', description: message, type: 'error' });
    } finally {
      dispatch(setLoading(false));
    }
  };

  return (
    <Box minH="100vh" bg="bg.subtle">
      <HStack maxW="7xl" mx="auto" px={{ base: 4, md: 6 }} py={5} justify="space-between">
        <Brand compact />
        <Button asChild variant="ghost">
          <Link to="/register">Create account</Link>
        </Button>
      </HStack>
      <Box maxW="md" mx="auto" px={4} py={{ base: 10, md: 20 }}>
        <chakra.form
          onSubmit={handleLogin}
          bg="bg.panel"
          borderWidth="1px"
          borderRadius="2xl"
          p={{ base: 6, md: 8 }}
          boxShadow="sm"
        >
          <VStack align="stretch" gap={6}>
            <Box>
              <Heading size="2xl">Welcome back</Heading>
              <Text color="fg.muted" mt={2}>
                Sign in to continue to your TaskForge workspace.
              </Text>
            </Box>
            {sessionExpired && (
              <Text role="alert" color="red.fg">
                {SESSION_EXPIRED_MESSAGE}
              </Text>
            )}
            <Field.Root required>
              <Field.Label>Email</Field.Label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                size="lg"
                autoComplete="email"
              />
            </Field.Root>
            <Field.Root required>
              <Field.Label>Password</Field.Label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                size="lg"
                autoComplete="current-password"
              />
            </Field.Root>
            <Button type="submit" size="lg" width="full" loading={loading}>
              Sign in
            </Button>
            <Text textAlign="center" color="fg.muted">
              New to TaskForge? <Link to="/register">Create an account</Link>
            </Text>
          </VStack>
        </chakra.form>
      </Box>
    </Box>
  );
};

export default LoginPage;
