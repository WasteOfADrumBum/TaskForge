import { useState, type FormEvent } from 'react';
import { Box, Button, Field, Heading, Input, Text, VStack } from '@chakra-ui/react';
import { Link, useNavigate } from 'react-router-dom';
import { toaster } from '../../components/ui/toaster';
import { login } from '../../api/auth';
import { useAppDispatch, useAppSelector } from '../../redux/hooks/typedHooks';
import { setError, setLoading, setToken } from '../../redux/slices/authSlice';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const loading = useAppSelector((state) => state.auth.loading);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    dispatch(setLoading(true));
    dispatch(setError(null));

    try {
      const data = await login({ email, password });
      localStorage.setItem('token', data.token);
      dispatch(setToken(data.token));
      toaster.create({
        title: 'Login Successful',
        description: 'You have logged in successfully.',
        type: 'success',
      });
      navigate('/home');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to log in';
      dispatch(setError(message));
      toaster.create({ title: 'Login Failed', description: message, type: 'error' });
    } finally {
      dispatch(setLoading(false));
    }
  };

  return (
    <Box
      as="form"
      onSubmit={handleLogin}
      maxW="md"
      mx="auto"
      mt={10}
      p={5}
      borderWidth={1}
      borderRadius="md"
      boxShadow="lg"
    >
      <Heading as="h2" size="xl" mb={6} textAlign="center">
        Login
      </Heading>
      <VStack gap="6">
        <Field.Root required>
          <Field.Label>Email</Field.Label>
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email"
            size="lg"
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
          />
        </Field.Root>
        <Button type="submit" size="lg" width="full" loading={loading}>
          Login
        </Button>
        <Text>
          Need an account? <Link to="/register">Register</Link>
        </Text>
      </VStack>
    </Box>
  );
};

export default LoginPage;
