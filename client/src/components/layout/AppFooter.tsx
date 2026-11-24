import type { ReactNode } from 'react';
import { LuGithub, LuHistory, LuLinkedin, LuMail } from 'react-icons/lu';
import styles from './AppFooter.module.css';

const githubUrl = 'https://github.com/WasteOfADrumBum/TaskForge';
const changelogUrl = githubUrl + '/blob/main/CHANGELOG.md';
const linkedinUrl = import.meta.env.VITE_LINKEDIN_URL as string | undefined;

const FooterLink = ({
  href,
  icon,
  children,
  external = true,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
  external?: boolean;
}) => (
  <a
    href={href}
    className={styles.link}
    {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
  >
    <span aria-hidden="true">{icon}</span>
    {children}
  </a>
);

const AppFooter = () => (
  <footer className={styles.footer}>
    <div className={styles.inner}>
      <div className={styles.links}>
        <FooterLink href={githubUrl} icon={<LuGithub />}>
          GitHub
        </FooterLink>
        <FooterLink href={changelogUrl} icon={<LuHistory />}>
          Changelog
        </FooterLink>
        <FooterLink href="mailto:JMSmall89@gmail.com" icon={<LuMail />} external={false}>
          Email
        </FooterLink>
        {linkedinUrl && (
          <FooterLink href={linkedinUrl} icon={<LuLinkedin />}>
            LinkedIn
          </FooterLink>
        )}
      </div>
      <p className="os-text-muted os-text-sm os-m-0">© 2026 Joshua Small · TaskForge</p>
    </div>
  </footer>
);

export default AppFooter;
