import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Heading, Input, VStack, Field } from '@chakra-ui/react';
import { toaster } from '../../components/ui/toaster';

const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleRegister = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      console.log('Login response:', data); // Log the response for debugging
      if (data.message === 'User registered successfully') {
        console.log('Registration successful:', data); // Log the success message for debugging
        toaster.create({
          title: 'Registration Successful',
          description: 'You have successfully registered.',
          type: 'success',
        });
        navigate('/login');
      } else {
        console.log('Registration failed:', data.message); // Log the error message for debugging
        toaster.create({
          title: 'Registration Failed',
          description: data.message,
          type: 'error',
        });
      }
    } catch (error) {
      console.error('Error registering user:', error);
      toaster.create({
        title: 'Error',
        description: 'An error occurred while registering.',
        type: 'error',
      });
    }
  };

  return (
    <Box maxW="md" mx="auto" mt={10} p={5} borderWidth={1} borderRadius="md" boxShadow="lg">
      <Heading as="h2" size="xl" mb={6} textAlign="center">
        Register
      </Heading>
      <VStack direction={{ base: 'column', md: 'row' }} gap="6">
        <Field.Root required>
          <Field.Label>Email</Field.Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            size="lg"
          />
        </Field.Root>

        <Field.Root required>
          <Field.Label>Password</Field.Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            size="lg"
          />
        </Field.Root>

        <Button colorScheme="teal" size="lg" width="full" onClick={handleRegister}>
          Register
        </Button>
      </VStack>
    </Box>
  );
};

export default RegisterPage;
