import { useTheme } from '@onesmall/ui';

export type ColorMode = 'light' | 'dark';
export type ColorModePreference = ColorMode | 'system';

export interface UseColorModeReturn {
  /** The saved preference: light, dark or follow the system. */
  preference: ColorModePreference;
  /** What is showing now. */
  colorMode: ColorMode;
  setColorMode: (mode: ColorModePreference) => void;
  toggleColorMode: () => void;
}

/** Reads and changes the color mode. Backed by OneSmallUI's ThemeProvider (see provider.tsx). */
export function useColorMode(): UseColorModeReturn {
  const { mode, resolvedTheme, setMode, toggle } = useTheme();
  return {
    preference: mode,
    colorMode: resolvedTheme,
    setColorMode: setMode,
    toggleColorMode: toggle,
  };
}
