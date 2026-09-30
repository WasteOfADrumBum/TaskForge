import { Box, HStack, Link, Text, VStack } from '@chakra-ui/react';
import { LuGithub, LuHistory, LuLinkedin, LuMail } from 'react-icons/lu';

const githubUrl = 'https://github.com/WasteOfADrumBum/TaskForge';
const changelogUrl = githubUrl + '/blob/main/CHANGELOG.md';
const linkedinUrl = import.meta.env.VITE_LINKEDIN_URL as string | undefined;

const AppFooter = () => (
  <Box as="footer" borderTopWidth="1px" bg="bg.panel" mt="auto">
    <VStack maxW="7xl" mx="auto" px={{ base: 4, md: 6 }} py={6} gap={3}>
      <HStack gap={5} flexWrap="wrap" justify="center">
        <Link href={githubUrl} target="_blank" rel="noreferrer">
          <HStack gap={1.5}>
            <LuGithub />
            <Text>GitHub</Text>
          </HStack>
        </Link>
        <Link href={changelogUrl} target="_blank" rel="noreferrer">
          <HStack gap={1.5}>
            <LuHistory />
            <Text>Changelog</Text>
          </HStack>
        </Link>
        <Link href="mailto:JMSmall89@gmail.com">
          <HStack gap={1.5}>
            <LuMail />
            <Text>Email</Text>
          </HStack>
        </Link>
        {linkedinUrl && (
          <Link href={linkedinUrl} target="_blank" rel="noreferrer">
            <HStack gap={1.5}>
              <LuLinkedin />
              <Text>LinkedIn</Text>
            </HStack>
          </Link>
        )}
      </HStack>
      <Text color="fg.muted" fontSize="sm">
        © 2026 Joshua Small · TaskForge
      </Text>
    </VStack>
  </Box>
);

export default AppFooter;
