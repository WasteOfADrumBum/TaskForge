import {
  Button,
  Sidebar as NavSidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
} from '@onesmall/ui';
import {
  LuBot,
  LuBookOpen,
  LuBriefcase,
  LuGraduationCap,
  LuChartColumn,
  LuGoal,
  LuLayoutDashboard,
  LuListChecks,
  LuNotebookPen,
  LuPalette,
  LuLogOut,
  LuSettings,
  LuUserRound,
} from 'react-icons/lu';
import { useLocation } from 'react-router-dom';
import { useLogout } from '../../hooks/useLogout';
import { RouterLink } from '../ui/links';
import Brand from './Brand';
import styles from './Shell.module.css';

export const navItems = [
  { to: '/home', label: 'Command Center', icon: LuLayoutDashboard },
  { to: '/work', label: 'Work', icon: LuListChecks },
  { to: '/progress', label: 'Progress', icon: LuChartColumn },
  { to: '/reviews', label: 'Reviews', icon: LuNotebookPen },
  { to: '/goals', label: 'Goals', icon: LuGoal },
  { to: '/career', label: 'Career', icon: LuBriefcase },
  { to: '/learning', label: 'Learning', icon: LuGraduationCap },
  { to: '/brand', label: 'Brand Studio', icon: LuPalette },
  { to: '/workforce', label: 'Workforce', icon: LuBot },
  { to: '/knowledge', label: 'Knowledge', icon: LuBookOpen },
  { to: '/settings', label: 'Settings', icon: LuSettings },
];

// Match whole path segments: '/workforce' must not count as the '/work' item.
export const isSectionActive = (pathname: string, to: string) =>
  pathname === to || pathname.startsWith(to + '/');

interface SidebarProps {
  // Called after a navigation so the mobile drawer can close itself.
  onNavigate?: () => void;
}

const Sidebar = ({ onNavigate }: SidebarProps) => {
  const logout = useLogout();
  const { pathname } = useLocation();
  return (
    <NavSidebar aria-label="Main navigation" drawerBelow={false} className={styles.sidebar}>
      <SidebarHeader>
        <RouterLink
          href="/home"
          onClick={onNavigate}
          aria-label="TaskForge Command Center"
          className={styles.brandLink}
        >
          <Brand />
        </RouterLink>
      </SidebarHeader>
      <p className={styles.sectionLabel} aria-hidden="true">
        Workspace
      </p>
      <SidebarSection>
        {navItems.map(({ to, label, icon: Icon }) => (
          <SidebarItem
            key={to}
            as={RouterLink}
            href={to}
            active={isSectionActive(pathname, to)}
            icon={<Icon size={18} />}
            onClick={onNavigate}
          >
            {label}
          </SidebarItem>
        ))}
      </SidebarSection>
      <SidebarFooter>
        <div className={styles.account}>
          <span className={styles.avatar} aria-hidden="true">
            <LuUserRound size={18} />
          </span>
          <div className={styles.accountText}>
            <p className="os-text-sm os-font-semibold os-m-0">Signed in</p>
            <p className="os-text-xs os-text-muted os-m-0">Personal workspace</p>
          </div>
          <Button
            iconOnly
            variant="ghost"
            size="sm"
            aria-label="Log out"
            onClick={() => void logout()}
          >
            <LuLogOut aria-hidden="true" />
          </Button>
        </div>
      </SidebarFooter>
    </NavSidebar>
  );
};

export default Sidebar;
