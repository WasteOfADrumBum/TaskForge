import { Grid, Stack } from '@onesmall/ui';
import { LuChartNoAxesCombined, LuLockKeyhole, LuListChecks } from 'react-icons/lu';
import AppFooter from '../../components/layout/AppFooter';
import Brand from '../../components/layout/Brand';
import { LinkButton } from '../../components/ui/links';
import styles from './Landing.module.css';

const features = [
  {
    icon: LuListChecks,
    title: 'Plan clearly',
    text: 'Create tasks with priorities, due dates, workflow tracking, search, filters, and sorting.',
    color: 'secondary',
  },
  {
    icon: LuChartNoAxesCombined,
    title: 'Stay focused',
    text: 'See workload metrics, overdue work, completion status, and the tasks that need attention.',
    color: 'info',
  },
  {
    icon: LuLockKeyhole,
    title: 'Work securely',
    text: 'JWT authentication and user-scoped data keep every workspace isolated to its owner.',
    color: 'primary',
  },
] as const;

const LandingPage = () => (
  <div className={styles.page}>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Brand compact />
        <Stack direction="row" gap={2}>
          <LinkButton to="/login" variant="ghost">
            Log in
          </LinkButton>
          <LinkButton to="/register" color="secondary">
            Get started
          </LinkButton>
        </Stack>
      </div>
    </header>
    <main className={styles.main}>
      <div className={styles.content}>
        <Stack gap={6} align="center" className={styles.hero}>
          <Brand hero />
          <h1 className={styles.title}>Turn your workload into a clear plan.</h1>
          <p className={styles.lead}>
            TaskForge is a secure productivity workspace for organizing tasks, priorities, due
            dates, and progress without unnecessary complexity.
          </p>
          <Stack direction="row" gap={3} wrap justify="center">
            <LinkButton to="/register" size="lg" color="secondary">
              Create an account
            </LinkButton>
            <LinkButton to="/login" size="lg" variant="outline" color="info">
              Sign in
            </LinkButton>
          </Stack>
        </Stack>
        <Grid columns={{ base: 1, md: 3 }} gap={5} className={styles.section}>
          {features.map(({ icon: Icon, title, text, color }) => (
            <div key={title} className={`tf-panel ${styles.feature}`} data-color={color}>
              <div className="os-flex os-items-center os-gap-3 os-mb-4">
                <span className={styles.featureIcon}>
                  <Icon size={20} aria-hidden="true" focusable="false" />
                </span>
                <h2 className="tf-h2 os-m-0">{title}</h2>
              </div>
              <p className="os-text-muted os-m-0">{text}</p>
            </div>
          ))}
        </Grid>
        <div className={`tf-panel ${styles.section} ${styles.stack}`}>
          <p className={styles.eyebrow}>Built with</p>
          <h2 className="tf-h2 os-mt-2 os-mb-0">
            React · TypeScript · Node.js · Express · MongoDB
          </h2>
          <p className="os-text-muted os-mt-3 os-mb-0 os-mx-auto">
            Deployed with Vercel, Render, and MongoDB Atlas.
          </p>
        </div>
      </div>
    </main>
    <AppFooter />
  </div>
);

export default LandingPage;
