import type { ReactNode } from 'react';
import Brand from '../layout/Brand';
import { LinkButton } from '../ui/links';
import styles from './AuthPage.module.css';

// Shared header and main landmark for the public account pages (sign-in and recovery).
const AuthPageFrame = ({
  children,
  headerAction = { label: 'Sign in', to: '/login' },
}: {
  children: ReactNode;
  headerAction?: { label: string; to: string };
}) => (
  <div className={styles.page}>
    <header className={styles.header}>
      <Brand compact />
      <LinkButton to={headerAction.to} variant="ghost">
        {headerAction.label}
      </LinkButton>
    </header>
    <main className={styles.main}>{children}</main>
  </div>
);

export default AuthPageFrame;
