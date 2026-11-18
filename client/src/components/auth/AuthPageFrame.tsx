import type { ReactNode } from 'react';
import { Box, Button, HStack } from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import Brand from '../layout/Brand';

// Shared header and main landmark for the public account pages (sign-in recovery).
const AuthPageFrame = ({ children }: { children: ReactNode }) => (
  <Box minH="100vh" bg="bg.subtle">
    <HStack as="header" maxW="7xl" mx="auto" px={{ base: 4, md: 6 }} py={5} justify="space-between">
      <Brand compact />
      <Button asChild variant="ghost">
        <Link to="/login">Sign in</Link>
      </Button>
    </HStack>
    <Box as="main" maxW="md" mx="auto" px={4} py={{ base: 10, md: 20 }}>
      {children}
    </Box>
  </Box>
);

export default AuthPageFrame;
