import { LuFolderKanban, LuListChecks } from 'react-icons/lu';
import { NavLink } from 'react-router-dom';
import styles from './Work.module.css';

const tabs = [
  // `end` keeps Tasks from also matching /work/projects.
  { to: '/work', label: 'Tasks', icon: LuListChecks, end: true },
  { to: '/work/projects', label: 'Projects', icon: LuFolderKanban, end: false },
];

// Second-level navigation inside the Work section.
const WorkTabs = () => (
  <nav aria-label="Work sections" className={styles.tabs}>
    <ul className={styles.tabList}>
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <li key={to}>
          <NavLink to={to} end={end} className={styles.tab}>
            <Icon size={16} aria-hidden="true" />
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
);

export default WorkTabs;
