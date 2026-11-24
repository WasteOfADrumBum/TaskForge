import styles from './Brand.module.css';

interface BrandProps {
  compact?: boolean;
  hero?: boolean;
}

// The logo files are cropped to their visible content, so these heights are the logo's real
// size. max-width keeps it inside narrow containers such as the sidebar.
const Brand = ({ compact = false, hero = false }: BrandProps) => (
  <img
    src={hero ? '/taskforge-logo.png' : '/taskforge-logo-alt.png'}
    alt="TaskForge"
    className={hero ? styles.hero : compact ? styles.compact : styles.regular}
  />
);

export default Brand;
