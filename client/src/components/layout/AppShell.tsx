import RequestFeedback from '../ui/RequestFeedback';
import { Drawer, SkipLink } from '@onesmall/ui';
import { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAgentLoader } from '../../hooks/useAgentLoader';
import { useProjectLoader } from '../../hooks/useProjectLoader';
import { useTaskLoader } from '../../hooks/useTaskLoader';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import AppFooter from './AppFooter';
import Sidebar from './Sidebar';
import TopBar, { MOBILE_NAV_ID } from './TopBar';
import styles from './Shell.module.css';

const MAIN_ID = 'main-content';

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
    <div className={styles.shell}>
      <SkipLink targetId={MAIN_ID}>Skip to content</SkipLink>
      <aside aria-label="Sidebar" className={styles.aside}>
        <Sidebar />
      </aside>
      {navOpen && (
        <Drawer
          id={MOBILE_NAV_ID}
          open={navOpen}
          onClose={closeNav}
          title="Navigation"
          closeLabel="Close navigation"
          placement="start"
          size="sm"
          className={styles.drawer}
        >
          <Sidebar onNavigate={closeNav} />
        </Drawer>
      )}
      <div className={styles.column}>
        <TopBar
          navOpen={navOpen}
          onOpenNav={() => setNavOpen(true)}
          onRefresh={refresh}
          refreshing={loading}
        />
        <main id={MAIN_ID} tabIndex={-1} className={styles.main}>
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
          <Suspense fallback={<p className="os-text-muted os-m-0">Loading...</p>}>
            <Outlet />
          </Suspense>
        </main>
        <AppFooter />
      </div>
    </div>
  );
};

export default AppShell;
