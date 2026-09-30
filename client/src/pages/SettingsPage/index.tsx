import { Box, Button, Heading, HStack, SimpleGrid, Text, VStack } from '@chakra-ui/react';
import { useTheme } from 'next-themes';
import { Link } from 'react-router-dom';
import { LuLaptop, LuMoon, LuSun, LuUserRound } from 'react-icons/lu';
import AppFooter from '../../components/layout/AppFooter';
import Brand from '../../components/layout/Brand';

const SettingsPage = () => {
  const { theme, setTheme } = useTheme();
  return (
    <Box minH="100vh" bg="bg.subtle" display="flex" flexDirection="column">
      <Box bg="bg.panel" borderBottomWidth="1px">
        <HStack maxW="7xl" mx="auto" px={{ base: 4, md: 6 }} py={4} justify="space-between">
          <Brand compact />
          <Button asChild variant="outline">
            <Link to="/home">Back to workspace</Link>
          </Button>
        </HStack>
      </Box>
      <Box maxW="7xl" w="full" mx="auto" px={{ base: 4, md: 6 }} py={8} flex="1">
        <Heading size="2xl">Settings</Heading>
        <Text color="fg.muted" mt={2} mb={8}>
          Manage your TaskForge workspace preferences.
        </Text>
        <SimpleGrid columns={{ base: 1, md: 4 }} gap={6}>
          <VStack align="stretch" gap={2}>
            <Button justifyContent="flex-start" variant="subtle">
              <LuUserRound />
              Account
            </Button>
            <Button justifyContent="flex-start" variant="ghost">
              Appearance
            </Button>
            <Button justifyContent="flex-start" variant="ghost" colorPalette="red">
              Danger Zone
            </Button>
          </VStack>
          <VStack gridColumn={{ md: 'span 3' }} align="stretch" gap={6}>
            <Box bg="bg.panel" borderWidth="1px" borderRadius="xl" p={6}>
              <Heading size="lg">Appearance</Heading>
              <Text color="fg.muted" mt={1} mb={5}>
                Choose how TaskForge looks on this device.
              </Text>
              <HStack gap={3} flexWrap="wrap">
                <Button
                  variant={theme === 'system' ? 'solid' : 'outline'}
                  onClick={() => setTheme('system')}
                >
                  <LuLaptop />
                  System
                </Button>
                <Button
                  variant={theme === 'light' ? 'solid' : 'outline'}
                  onClick={() => setTheme('light')}
                >
                  <LuSun />
                  Light
                </Button>
                <Button
                  variant={theme === 'dark' ? 'solid' : 'outline'}
                  onClick={() => setTheme('dark')}
                >
                  <LuMoon />
                  Dark
                </Button>
              </HStack>
            </Box>
            <Box bg="bg.panel" borderWidth="1px" borderRadius="xl" p={6}>
              <Heading size="lg">Account</Heading>
              <Text color="fg.muted" mt={2}>
                Account profile details and account deletion will be added with the next
                authenticated user-management API phase.
              </Text>
            </Box>
          </VStack>
        </SimpleGrid>
      </Box>
      <AppFooter />
    </Box>
  );
};

export default SettingsPage;
