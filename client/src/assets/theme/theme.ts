import { createSystem, defaultConfig } from '@chakra-ui/react';

// The dark palette follows the TaskForge v2 command-center prototype: near-black surfaces,
// teal primary, orange secondary, violet tertiary. Light mode keeps Chakra's defaults.
export const system = createSystem(defaultConfig, {
  theme: {
    tokens: {
      fonts: {
        heading: { value: `'Figtree', system-ui, sans-serif` },
        body: { value: `'Figtree', system-ui, sans-serif` },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: { value: { _light: '{colors.white}', _dark: '#101216' } },
          subtle: { value: { _light: '{colors.gray.50}', _dark: '#101216' } },
          muted: { value: { _light: '{colors.gray.100}', _dark: '#1b1f26' } },
          emphasized: { value: { _light: '{colors.gray.200}', _dark: '#242a33' } },
          panel: { value: { _light: '{colors.white}', _dark: '#171b22' } },
        },
        fg: {
          DEFAULT: { value: { _light: '{colors.black}', _dark: '#e6eaf0' } },
          muted: { value: { _light: '{colors.gray.600}', _dark: '#9ca6b5' } },
        },
        border: {
          DEFAULT: { value: { _light: '{colors.gray.200}', _dark: '#2b323d' } },
          muted: { value: { _light: '{colors.gray.100}', _dark: '#232933' } },
          emphasized: { value: { _light: '{colors.gray.300}', _dark: '#37424f' } },
        },
        // Chakra's default teal.solid (teal.600 with white text) is ~3.7:1, below WCAG AA.
        // Light: darker teal with white text. Dark: the v2 mint with near-black text.
        teal: {
          solid: { value: { _light: '{colors.teal.700}', _dark: '#72dccb' } },
          contrast: { value: { _light: '{colors.white}', _dark: '#082720' } },
        },
        accent: {
          teal: { value: { _light: '{colors.teal.700}', _dark: '#72dccb' } },
          orange: { value: { _light: '{colors.orange.700}', _dark: '#e8ad78' } },
          violet: { value: { _light: '{colors.purple.600}', _dark: '#b7a4ed' } },
          tealSubtle: { value: { _light: '{colors.teal.50}', _dark: '#19302e' } },
          orangeSubtle: { value: { _light: '{colors.orange.50}', _dark: '#30241d' } },
          violetSubtle: { value: { _light: '{colors.purple.50}', _dark: '#282232' } },
        },
        shell: {
          sidebar: { value: { _light: '{colors.gray.50}', _dark: '#14171c' } },
          topbar: { value: { _light: '{colors.white}', _dark: '#12151a' } },
        },
      },
    },
  },
});
