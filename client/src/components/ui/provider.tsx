import { ChakraProvider } from '@chakra-ui/react';
import { ThemeProvider, useTheme } from '@onesmall/ui';
import { useEffect, type ReactNode } from 'react';
import { system } from '../../assets/theme/theme';

// The saved color mode lives under the same localStorage key next-themes used ("light", "dark" or
// "system"), so a choice made before the move to OneSmallUI is kept. Dark is the default.
export const THEME_STORAGE_KEY = 'theme';

// OneSmallUI sets `data-os-theme` on <html>. While Chakra still renders some screens, mirror the
// resolved mode onto the `light`/`dark` class Chakra's `_dark` styles read.
const ChakraModeBridge = () => {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);
  return null;
};

export function Provider({ children }: { children?: ReactNode }) {
  return (
    <ChakraProvider value={system}>
      <ThemeProvider defaultMode="dark" storageKey={THEME_STORAGE_KEY}>
        <ChakraModeBridge />
        {children}
      </ThemeProvider>
    </ChakraProvider>
  );
}
