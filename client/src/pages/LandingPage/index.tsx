import { Badge, Box, Button, Heading, HStack, SimpleGrid, Text, VStack } from '@chakra-ui/react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <Box minH="100vh" bg="bg.subtle">
      <Box borderBottomWidth="1px" bg="bg.panel">
        <HStack maxW="7xl" mx="auto" px={{ base: 4, md: 6 }} py={5} justify="space-between">
          <Heading size="xl">TaskForge</Heading>
          <HStack>
            <Button asChild variant="ghost">
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link to="/register">Get started</Link>
            </Button>
          </HStack>
        </HStack>
      </Box>

      <Box maxW="7xl" mx="auto" px={{ base: 4, md: 6 }} py={{ base: 16, md: 24 }}>
        <VStack textAlign="center" gap={6} maxW="4xl" mx="auto">
          <Badge colorPalette="blue" size="lg">
            Full-stack task management
          </Badge>
          <Heading size={{ base: '3xl', md: '5xl' }}>Turn your workload into a clear plan.</Heading>
          <Text fontSize={{ base: 'lg', md: 'xl' }} color="fg.muted" maxW="3xl">
            TaskForge is a secure full-stack productivity application for organizing tasks,
            priorities, due dates, and progress in one focused workspace.
          </Text>
          <HStack gap={3} flexWrap="wrap" justify="center">
            <Button asChild size="lg">
              <Link to="/register">Create an account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Sign in</Link>
            </Button>
          </HStack>
        </VStack>

        <SimpleGrid columns={{ base: 1, md: 3 }} gap={5} mt={{ base: 16, md: 24 }}>
          <Box bg="bg.panel" borderWidth="1px" borderRadius="xl" p={6}>
            <Heading size="md">Plan clearly</Heading>
            <Text color="fg.muted" mt={3}>
              Create tasks with priorities, due dates, status tracking, search, filters, and
              sorting.
            </Text>
          </Box>
          <Box bg="bg.panel" borderWidth="1px" borderRadius="xl" p={6}>
            <Heading size="md">Stay focused</Heading>
            <Text color="fg.muted" mt={3}>
              See workload metrics, overdue work, completion status, and the tasks that need
              attention.
            </Text>
          </Box>
          <Box bg="bg.panel" borderWidth="1px" borderRadius="xl" p={6}>
            <Heading size="md">Work securely</Heading>
            <Text color="fg.muted" mt={3}>
              Accounts are protected with JWT authentication and every task is scoped to its owner.
            </Text>
          </Box>
        </SimpleGrid>
      </Box>
    </Box>
  );
};

export default LandingPage;
