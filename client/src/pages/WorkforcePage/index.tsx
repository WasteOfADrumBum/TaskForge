import { Alert, Badge, Box, Heading, HStack, Link, SimpleGrid, Text } from '@chakra-ui/react';
import { LuBot, LuHistory, LuKeyRound, LuListChecks, LuWrench } from 'react-icons/lu';

const phase2Url =
  'https://github.com/WasteOfADrumBum/TaskForge/blob/main/docs/phases/phase-2-ai-workforce.md';

// Planned concepts only. Nothing on this page is persisted or executed.
const concepts = [
  {
    title: 'Workers',
    icon: LuBot,
    text: 'Registered AI agents, each with a role, description, and on/off status.',
  },
  {
    title: 'Skills',
    icon: LuWrench,
    text: 'What each worker is good at, used to match workers to tasks.',
  },
  {
    title: 'Permissions',
    icon: LuKeyRound,
    text: 'Explicit limits on the tools and data each worker may use.',
  },
  {
    title: 'Assignments',
    icon: LuListChecks,
    text: 'TaskForge tasks handed to a worker, with a human approving every result.',
  },
  {
    title: 'Runs',
    icon: LuHistory,
    text: 'A recorded history of each attempt: input, context, result, and status.',
  },
];

const WorkforcePage = () => (
  <Box>
    <Box mb={{ base: 6, md: 8 }}>
      <Text
        color="accent.violet"
        fontSize="xs"
        fontWeight="semibold"
        letterSpacing="widest"
        textTransform="uppercase"
      >
        Phase 2
      </Text>
      <Heading as="h1" size={{ base: '2xl', md: '3xl' }} mt={1.5}>
        Workforce
      </Heading>
    </Box>
    <Alert.Root status="info" variant="surface" mb={{ base: 6, md: 8 }}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>AI Workforce is planned and not yet enabled.</Alert.Title>
        <Alert.Description>
          No AI workers exist and no AI calls are made. The concepts below describe what Phase 2
          will add. Read the{' '}
          <Link href={phase2Url} target="_blank" rel="noreferrer" textDecoration="underline">
            Phase 2 plan
          </Link>
          .
        </Alert.Description>
      </Alert.Content>
    </Alert.Root>
    <SimpleGrid
      as="ul"
      listStyleType="none"
      m={0}
      p={0}
      columns={{ base: 1, md: 2, xl: 3 }}
      gap={4}
      aria-label="Planned workforce concepts"
    >
      {concepts.map(({ title, icon: Icon, text }) => (
        <Box as="li" key={title} bg="bg.panel" borderWidth="1px" borderRadius="lg" p={5}>
          <HStack justify="space-between" mb={3}>
            <Box
              display="grid"
              placeItems="center"
              boxSize="9"
              borderRadius="md"
              bg="accent.violetSubtle"
              color="accent.violet"
              aria-hidden="true"
            >
              <Icon size={18} />
            </Box>
            <Badge variant="outline" colorPalette="purple">
              Planned
            </Badge>
          </HStack>
          <Heading as="h2" size="md">
            {title}
          </Heading>
          <Text color="fg.muted" fontSize="sm" mt={1.5}>
            {text}
          </Text>
        </Box>
      ))}
    </SimpleGrid>
  </Box>
);

export default WorkforcePage;
