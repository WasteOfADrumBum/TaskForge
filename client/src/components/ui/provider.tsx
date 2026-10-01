'use client';

import { ChakraProvider } from '@chakra-ui/react';
import { system } from '../../assets/theme/theme';
import { ColorModeProvider, type ColorModeProviderProps } from './color-mode';

export function Provider(props: ColorModeProviderProps) {
  return (
    <ChakraProvider value={system}>
      <ColorModeProvider defaultTheme="dark" enableSystem {...props} />
    </ChakraProvider>
  );
}
