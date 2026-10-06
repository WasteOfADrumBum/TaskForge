import { Box, Button, Heading, HStack, SimpleGrid, Text, VStack } from '@chakra-ui/react';
import { LuChartNoAxesCombined, LuLockKeyhole, LuListChecks } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import AppFooter from '../../components/layout/AppFooter';
import Brand from '../../components/layout/Brand';

const features = [
  {
    icon: LuListChecks,
    title: 'Plan clearly',
    text: 'Create tasks with priorities, due dates, workflow tracking, search, filters, and sorting.',
    color: 'orange',
  },
  {
    icon: LuChartNoAxesCombined,
    title: 'Stay focused',
    text: 'See workload metrics, overdue work, completion status, and the tasks that need attention.',
    color: 'blue',
  },
  {
    icon: LuLockKeyhole,
    title: 'Work securely',
    text: 'JWT authentication and user-scoped data keep every workspace isolated to its owner.',
    color: 'cyan',
  },
];

const LandingPage = () => (
  <Box minH="100vh" bg="bg.subtle" display="flex" flexDirection="column">
    <Box borderBottomWidth="1px" bg="bg.panel">
      <HStack maxW="7xl" mx="auto" px={{ base: 4, md: 6 }} py={3} justify="space-between">
        <Brand compact />
        <HStack>
          <Button asChild variant="ghost">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild colorPalette="orange">
            <Link to="/register">Get started</Link>
          </Button>
        </HStack>
      </HStack>
    </Box>
    <Box flex="1">
      <Box maxW="7xl" mx="auto" px={{ base: 4, md: 6 }} py={{ base: 14, md: 20 }}>
        <VStack textAlign="center" gap={6} maxW="4xl" mx="auto">
          <Brand hero />
          <Heading as="h1" size={{ base: '3xl', md: '5xl' }}>
            Turn your workload into a clear plan.
          </Heading>
          <Text fontSize={{ base: 'lg', md: 'xl' }} color="fg.muted" maxW="3xl">
            TaskForge is a secure productivity workspace for organizing tasks, priorities, due
            dates, and progress without unnecessary complexity.
          </Text>
          <HStack gap={3} flexWrap="wrap" justify="center">
            <Button asChild size="lg" colorPalette="orange">
              <Link to="/register">Create an account</Link>
            </Button>
            <Button asChild size="lg" variant="outline" colorPalette="blue">
              <Link to="/login">Sign in</Link>
            </Button>
          </HStack>
        </VStack>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={5} mt={{ base: 14, md: 20 }}>
          {features.map(({ icon: Icon, title, text, color }) => (
            <Box
              key={title}
              bg="bg.panel"
              borderWidth="1px"
              borderTopWidth="3px"
              borderTopColor={color + '.400'}
              borderRadius="xl"
              p={6}
              transition="all 0.18s ease"
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
            >
              <HStack gap={3} mb={4}>
                <Box
                  display="grid"
                  placeItems="center"
                  boxSize="10"
                  borderRadius="lg"
                  bg={color + '.subtle'}
                  color={color + '.fg'}
                  flexShrink={0}
                >
                  <Icon size={20} aria-hidden="true" focusable="false" />
                </Box>
                <Heading as="h2" size="md">
                  {title}
                </Heading>
              </HStack>
              <Text color="fg.muted">{text}</Text>
            </Box>
          ))}
        </SimpleGrid>
        <Box
          mt={{ base: 14, md: 20 }}
          bg="bg.panel"
          borderWidth="1px"
          borderRadius="2xl"
          p={{ base: 6, md: 10 }}
          textAlign="center"
        >
          <Text color="blue.400" fontSize="sm" textTransform="uppercase" letterSpacing="widest">
            Built with
          </Text>
          <Heading as="h2" size="lg" mt={2}>
            React · TypeScript · Node.js · Express · MongoDB
          </Heading>
          <Text color="fg.muted" mt={3}>
            Deployed with Vercel, Render, and MongoDB Atlas.
          </Text>
        </Box>
      </Box>
    </Box>
    <AppFooter />
  </Box>
);

export default LandingPage;
