import { Breadcrumb, Button, HStack, IconButton, Text } from '@chakra-ui/react';
import { LuPanelLeftOpen, LuPlus, LuRefreshCw } from 'react-icons/lu';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToday } from '../../hooks/useToday';
import { navItems } from './Sidebar';

export const MOBILE_NAV_ID = 'mobile-navigation';

interface TopBarProps {
  navOpen: boolean;
  onOpenNav: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

const dateFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const TopBar = ({ navOpen, onOpenNav, onRefresh, refreshing }: TopBarProps) => {
  const today = useToday();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Match whole path segments: '/workforce' must not match the '/work' item.
  const section =
    navItems.find((item) => pathname === item.to || pathname.startsWith(item.to + '/'))?.label ??
    'Workspace';

  return (
    <HStack
      as="header"
      justify="space-between"
      gap={3}
      minH={{ base: '60px', md: '68px' }}
      px={{ base: 4, md: 6, xl: 9 }}
      bg="shell.topbar"
      borderBottomWidth="1px"
      position="sticky"
      top="0"
      zIndex="docked"
    >
      <HStack gap={3} minW="0">
        <IconButton
          aria-label="Open navigation"
          aria-expanded={navOpen}
          aria-controls={MOBILE_NAV_ID}
          variant="outline"
          size="sm"
          display={{ base: 'inline-flex', lg: 'none' }}
          onClick={onOpenNav}
        >
          <LuPanelLeftOpen />
        </IconButton>
        <Breadcrumb.Root size="sm">
          <Breadcrumb.List>
            <Breadcrumb.Item display={{ base: 'none', sm: 'inline-flex' }} color="fg.muted">
              Workspace
            </Breadcrumb.Item>
            <Breadcrumb.Separator display={{ base: 'none', sm: 'inline-flex' }} />
            <Breadcrumb.Item>
              <Breadcrumb.CurrentLink fontWeight="medium" truncate>
                {section}
              </Breadcrumb.CurrentLink>
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb.Root>
      </HStack>
      <HStack gap={{ base: 2, md: 3 }} flexShrink={0}>
        <Text fontSize="sm" color="fg.muted" display={{ base: 'none', md: 'block' }}>
          {dateFormat.format(today)}
        </Text>
        <IconButton
          aria-label="Refresh workspace"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          loading={refreshing}
        >
          <LuRefreshCw />
        </IconButton>
        <Button
          size="sm"
          colorPalette="teal"
          // Replace rather than push when already on /work, so Back never lands on an older
          // request id and silently resets an edit.
          onClick={() =>
            navigate('/work', { state: { newTask: Date.now() }, replace: pathname === '/work' })
          }
        >
          <LuPlus />
          New Task
        </Button>
      </HStack>
    </HStack>
  );
};

export default TopBar;
