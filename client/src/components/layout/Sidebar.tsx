import { Box, Flex, HStack, IconButton, Text, VStack } from '@chakra-ui/react';
import {
  LuBot,
  LuBookOpen,
  LuLayoutDashboard,
  LuListChecks,
  LuLogOut,
  LuSettings,
  LuUserRound,
} from 'react-icons/lu';
import { NavLink } from 'react-router-dom';
import { useLogout } from '../../hooks/useLogout';
import Brand from './Brand';

export const navItems = [
  { to: '/home', label: 'Command Center', icon: LuLayoutDashboard },
  { to: '/work', label: 'Work', icon: LuListChecks },
  { to: '/workforce', label: 'Workforce', icon: LuBot },
  { to: '/knowledge', label: 'Knowledge', icon: LuBookOpen },
  { to: '/settings', label: 'Settings', icon: LuSettings },
];

interface SidebarProps {
  // Called after a navigation so the mobile drawer can close itself.
  onNavigate?: () => void;
}

const Sidebar = ({ onNavigate }: SidebarProps) => {
  const logout = useLogout();
  return (
    <Flex direction="column" h="full" px={4} py={6} gap={8}>
      <Box px={2}>
        <NavLink to="/home" onClick={onNavigate} aria-label="TaskForge Command Center">
          <Brand />
        </NavLink>
      </Box>
      <Box>
        <Text
          px={3}
          mb={2}
          fontSize="xs"
          fontWeight="semibold"
          letterSpacing="widest"
          color="fg.muted"
          textTransform="uppercase"
        >
          Workspace
        </Text>
        <Box as="nav" aria-label="Main navigation">
          <VStack as="ul" listStyleType="none" align="stretch" gap={1} m={0} p={0}>
            {navItems.map(({ to, label, icon: Icon }) => (
              <Box as="li" key={to}>
                <Box
                  asChild
                  display="flex"
                  alignItems="center"
                  gap={3}
                  px={3}
                  py={2.5}
                  borderRadius="md"
                  borderLeftWidth="2px"
                  borderLeftColor="transparent"
                  color="fg.muted"
                  fontSize="sm"
                  fontWeight="medium"
                  _hover={{ bg: 'bg.muted', color: 'fg' }}
                  _focusVisible={{
                    outline: '2px solid',
                    outlineColor: 'accent.teal',
                    outlineOffset: '2px',
                  }}
                  _currentPage={{
                    bg: 'accent.tealSubtle',
                    color: 'accent.teal',
                    borderLeftColor: 'accent.teal',
                  }}
                >
                  <NavLink to={to} onClick={onNavigate}>
                    <Icon size={18} aria-hidden="true" />
                    <Text as="span" flex="1">
                      {label}
                    </Text>
                  </NavLink>
                </Box>
              </Box>
            ))}
          </VStack>
        </Box>
      </Box>
      <HStack mt="auto" pt={4} borderTopWidth="1px" gap={3}>
        <Box
          display="grid"
          placeItems="center"
          boxSize="9"
          borderRadius="md"
          bg="accent.tealSubtle"
          color="accent.teal"
          flexShrink={0}
          aria-hidden="true"
        >
          <LuUserRound size={18} />
        </Box>
        <Box flex="1" minW="0">
          <Text fontSize="sm" fontWeight="semibold">
            Signed in
          </Text>
          <Text fontSize="xs" color="fg.muted">
            Personal workspace
          </Text>
        </Box>
        <IconButton aria-label="Log out" variant="ghost" size="sm" onClick={() => void logout()}>
          <LuLogOut />
        </IconButton>
      </HStack>
    </Flex>
  );
};

export default Sidebar;
