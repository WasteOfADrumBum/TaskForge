import { Box, Button, Heading, HStack, Text, VStack } from '@chakra-ui/react';
import { useTheme } from 'next-themes';
import { LuLaptop, LuMoon, LuSun } from 'react-icons/lu';

const SettingsPage = () => {
  const { theme, setTheme } = useTheme();
  return (
    <Box>
      <Heading as="h1" size={{ base: '2xl', md: '3xl' }}>
        Settings
      </Heading>
      <Text color="fg.muted" mt={2} mb={8}>
        Manage your TaskForge workspace preferences.
      </Text>
      <VStack maxW="3xl" align="stretch" gap={6}>
        <Box bg="bg.panel" borderWidth="1px" borderRadius="lg" p={6}>
          <Heading as="h2" size="lg">
            Appearance
          </Heading>
          <Text color="fg.muted" mt={1} mb={5}>
            Choose how TaskForge looks on this device.
          </Text>
          <HStack gap={3} flexWrap="wrap" role="group" aria-label="Color theme">
            <Button
              variant={theme === 'system' ? 'solid' : 'outline'}
              aria-pressed={theme === 'system'}
              onClick={() => setTheme('system')}
            >
              <LuLaptop aria-hidden="true" focusable="false" />
              System
            </Button>
            <Button
              variant={theme === 'light' ? 'solid' : 'outline'}
              aria-pressed={theme === 'light'}
              onClick={() => setTheme('light')}
            >
              <LuSun aria-hidden="true" focusable="false" />
              Light
            </Button>
            <Button
              variant={theme === 'dark' ? 'solid' : 'outline'}
              aria-pressed={theme === 'dark'}
              onClick={() => setTheme('dark')}
            >
              <LuMoon aria-hidden="true" focusable="false" />
              Dark
            </Button>
          </HStack>
        </Box>
        <Box bg="bg.panel" borderWidth="1px" borderRadius="lg" p={6}>
          <Heading as="h2" size="lg">
            Account
          </Heading>
          <Text color="fg.muted" mt={2}>
            Profile details and account-management controls are planned and are not available yet.
          </Text>
        </Box>
        <Box bg="bg.panel" borderWidth="1px" borderRadius="lg" p={6}>
          <Heading as="h2" size="lg">
            Danger Zone
          </Heading>
          <Text color="fg.muted" mt={2}>
            Account deletion is planned and is not available yet.
          </Text>
        </Box>
      </VStack>
    </Box>
  );
};
export default SettingsPage;
