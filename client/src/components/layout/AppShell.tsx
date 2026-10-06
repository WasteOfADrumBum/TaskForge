import RequestFeedback from '../ui/RequestFeedback';
import {
  Box,
  CloseButton,
  Drawer,
  Flex,
  Portal,
  SkipNavContent,
  SkipNavLink,
  Text,
} from '@chakra-ui/react';
import { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAgentLoader } from '../../hooks/useAgentLoader';
import { useProjectLoader } from '../../hooks/useProjectLoader';
import { useTaskLoader } from '../../hooks/useTaskLoader';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import AppFooter from './AppFooter';
import Sidebar from './Sidebar';
import TopBar, { MOBILE_NAV_ID } from './TopBar';

const SIDEBAR_WIDTH = '248px';

// Authenticated layout: persistent sidebar on large screens, a drawer below `lg`.
const AppShell = () => {
  const [navOpen, setNavOpen] = useState(false);
  const refreshTasks = useTaskLoader();
  const refreshProjects = useProjectLoader();
  const refreshAgents = useAgentLoader();
  const refresh = () => {
    refreshTasks.reload();
    refreshProjects.reload();
    refreshAgents.reload();
  };
  const loading = useAppSelector(
    (state) => state.tasks.loading || state.projects.loading || state.agents.loading,
  );
  const error = useAppSelector(
    (state) => state.tasks.error || state.projects.error || state.agents.error,
  );
  const waiting = refreshTasks.waiting || refreshProjects.waiting || refreshAgents.waiting;
  const cancelLoading = () => {
    refreshTasks.cancel();
    refreshProjects.cancel();
    refreshAgents.cancel();
  };
  const recovered = refreshTasks.recovered || refreshProjects.recovered || refreshAgents.recovered;
  const closeNav = () => setNavOpen(false);

  return (
    <Box minH="100vh" bg="bg">
      <SkipNavLink>Skip to content</SkipNavLink>
      <Box
        as="aside"
        aria-label="Sidebar"
        display={{ base: 'none', lg: 'block' }}
        position="fixed"
        insetY="0"
        left="0"
        w={SIDEBAR_WIDTH}
        bg="shell.sidebar"
        borderRightWidth="1px"
        overflowY="auto"
        zIndex="sticky"
      >
        <Sidebar />
      </Box>
      {/* Set the content id through `ids`: an `id` prop on Drawer.Content would break the
          dialog's focus trap and Escape handling, which look the element up by id. */}
      <Drawer.Root
        open={navOpen}
        onOpenChange={(details) => setNavOpen(details.open)}
        placement="start"
        ids={{ content: MOBILE_NAV_ID }}
        lazyMount
        unmountOnExit
      >
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content bg="shell.sidebar" maxW="280px">
              <Drawer.Title srOnly>Navigation</Drawer.Title>
              <Drawer.CloseTrigger asChild top="4" insetEnd="3">
                <CloseButton size="sm" aria-label="Close navigation" />
              </Drawer.CloseTrigger>
              <Sidebar onNavigate={closeNav} />
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
      <Flex direction="column" minH="100vh" ml={{ base: 0, lg: SIDEBAR_WIDTH }} minW="0">
        <TopBar
          navOpen={navOpen}
          onOpenNav={() => setNavOpen(true)}
          onRefresh={refresh}
          refreshing={loading}
        />
        <SkipNavContent />
        <Box
          as="main"
          flex="1"
          w="full"
          maxW="1600px"
          mx="auto"
          minW="0"
          px={{ base: 4, md: 6, xl: 9 }}
          py={{ base: 6, md: 8 }}
        >
          {waiting && loading ? (
            <RequestFeedback
              message="TaskForge may be waking up. Your data is still loading."
              onCancel={cancelLoading}
            />
          ) : error && !loading ? (
            <RequestFeedback
              message={
                error.startsWith('Loading cancelled.')
                  ? 'Loading stopped. Your existing data is unchanged.'
                  : 'Some workspace data could not be confirmed. You can retry loading.'
              }
              onRetry={refresh}
            />
          ) : recovered && !loading ? (
            <RequestFeedback message="Your data is up to date." />
          ) : null}
          <Suspense fallback={<Text color="fg.muted">Loading...</Text>}>
            <Outlet />
          </Suspense>
        </Box>
        <AppFooter />
      </Flex>
    </Box>
  );
};

export default AppShell;
