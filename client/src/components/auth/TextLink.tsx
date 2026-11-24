import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';

// In-text link. OneSmallUI's base link style underlines it, so it is not told apart from body text
// by color alone.
const TextLink = ({ to, children }: { to: string; children: ReactNode }) => (
  <RouterLink to={to}>{children}</RouterLink>
);

export default TextLink;
