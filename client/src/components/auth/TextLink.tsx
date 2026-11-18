import type { ReactNode } from 'react';
import { Link as ChakraLink } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

// In-text link that is underlined, so it is not told apart from body text by color alone.
const TextLink = ({ to, children }: { to: string; children: ReactNode }) => (
  <ChakraLink asChild textDecoration="underline" textUnderlineOffset="3px" color="fg">
    <RouterLink to={to}>{children}</RouterLink>
  </ChakraLink>
);

export default TextLink;
