import { ThemeProvider } from '@onesmall/ui';
import type { ReactNode } from 'react';

// The saved color mode lives under the same localStorage key next-themes used ("light", "dark" or
// "system"), so a choice made before the move to OneSmallUI is kept. Dark is the default.
// OneSmallUI sets `data-os-theme` on <html>, which switches every --os-* token and color-scheme.
export const THEME_STORAGE_KEY = 'theme';

export function Provider({ children }: { children?: ReactNode }) {
  return (
    <ThemeProvider defaultMode="dark" storageKey={THEME_STORAGE_KEY}>
      {children}
    </ThemeProvider>
  );
}
