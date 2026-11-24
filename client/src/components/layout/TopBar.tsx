import { Breadcrumb, BreadcrumbItem, Button } from '@onesmall/ui';
import { LuPanelLeftOpen, LuPlus, LuRefreshCw } from 'react-icons/lu';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToday } from '../../hooks/useToday';
import { isSectionActive, navItems } from './Sidebar';
import styles from './Shell.module.css';

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
  const section = navItems.find((item) => isSectionActive(pathname, item.to))?.label ?? 'Workspace';

  return (
    <header className={styles.topbar}>
      <div className={styles.topbarStart}>
        <Button
          iconOnly
          variant="outline"
          size="sm"
          aria-label="Open navigation"
          aria-expanded={navOpen}
          aria-controls={MOBILE_NAV_ID}
          className={styles.navToggle}
          onClick={onOpenNav}
        >
          <LuPanelLeftOpen aria-hidden="true" />
        </Button>
        <Breadcrumb separator="slash" className={styles.breadcrumb}>
          <BreadcrumbItem className={styles.breadcrumbRoot}>Workspace</BreadcrumbItem>
          <BreadcrumbItem current>{section}</BreadcrumbItem>
        </Breadcrumb>
      </div>
      <div className={styles.topbarEnd}>
        <p className={styles.date}>{dateFormat.format(today)}</p>
        <Button
          iconOnly
          variant="outline"
          size="sm"
          aria-label="Refresh workspace"
          onClick={onRefresh}
          loading={refreshing}
        >
          <LuRefreshCw aria-hidden="true" />
        </Button>
        <Button
          size="sm"
          leftIcon={<LuPlus />}
          // Replace rather than push when already on /work, so Back never lands on an older
          // request id and silently resets an edit.
          onClick={() =>
            navigate('/work', { state: { newTask: Date.now() }, replace: pathname === '/work' })
          }
        >
          New Task
        </Button>
      </div>
    </header>
  );
};

export default TopBar;
