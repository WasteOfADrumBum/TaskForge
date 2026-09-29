import { useState, type FormEvent } from 'react';
import { Box, Button, Field, Heading, Input, Text, VStack } from '@chakra-ui/react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../../api/auth';
import { toaster } from '../../components/ui/toaster';
import { useAppDispatch, useAppSelector } from '../../redux/hooks/typedHooks';
import { setError, setLoading } from '../../redux/slices/authSlice';

const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const loading = useAppSelector((state) => state.auth.loading);

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    dispatch(setLoading(true));
    dispatch(setError(null));

    try {
      await register({ email, password });
      toaster.create({
        title: 'Registration Successful',
        description: 'Your account has been created. You can now log in.',
        type: 'success',
      });
      navigate('/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to register';
      dispatch(setError(message));
      toaster.create({ title: 'Registration Failed', description: message, type: 'error' });
    } finally {
      dispatch(setLoading(false));
    }
  };

  return (
    <Box
      as="form"
      onSubmit={handleRegister}
      maxW="md"
      mx="auto"
      mt={10}
      p={5}
      borderWidth={1}
      borderRadius="md"
      boxShadow="lg"
    >
      <Heading as="h2" size="xl" mb={6} textAlign="center">
        Register
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
          Register
        </Button>
        <Text>
          Already have an account? <Link to="/login">Login</Link>
        </Text>
      </VStack>
    </Box>
  );
};

export default RegisterPage;
