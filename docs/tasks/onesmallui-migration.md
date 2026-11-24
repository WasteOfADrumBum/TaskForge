# OneSmallUI migration

Moves the client from Chakra UI v3 to OneSmallUI (`@onesmall/ui`), the owner's own React component
library, so TaskForge also showcases the design system. Planned after v1.0.0 and built on the
`feat/onesmallui-migration` branch; it changes no API, data or server code.

## What changed

| Phase                          | Scope                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Foundation and public pages | `@onesmall/ui` 0.6.0 (exact pin); palette as `--os-*` tokens in `assets/theme/onesmall-theme.css` with a contrast test; OneSmallUI `ThemeProvider` in place of next-themes (same `theme` storage key); toast bridge (`components/ui/toaster.tsx`); router-aware `RouterLink` and `LinkButton` (`components/ui/links.tsx`); landing, sign-in, registration, password recovery, 404, footer and shared components. |
| 2. App shell                   | Sidebar (`Sidebar`, `SidebarItem` with router links), top bar (`Breadcrumb`, `Button`), mobile `Drawer`, `SkipLink`.                                                                                                                                                                                                                                                                                             |
| 3 and 4. Components and pages  | Every remaining page and its cards, forms, badges and dialogs, in five groups (Work, Workforce and runs, Knowledge and Command Center, growth pages, career and learning).                                                                                                                                                                                                                                       |
| 5. Remove Chakra               | `@chakra-ui/react`, `@chakra-ui/theme`, `@chakra-ui/theme-tools` and `@emotion/react` uninstalled (116 packages); the Chakra theme, tooltip snippet and cascade-layer bridge removed.                                                                                                                                                                                                                            |

During phases 1 to 4 both libraries loaded, with OneSmallUI imported into a cascade layer after
Chakra's `reset` layer. That bridge is gone in phase 5.

## Behavior notes

- Required fields carry OneSmallUI's visually hidden "(required)" in their accessible name.
- Delete dialogs gain OneSmallUI's standard close button (it acts like Cancel).
- Saving buttons use `aria-busy` and `aria-disabled` and ignore clicks instead of being natively
  disabled, so focus stays on them.
- The dark and light palettes keep TaskForge's colors; derived tokens (hover, soft, text, on-) are
  tuned so every text pair reaches 7:1 and every boundary 3:1 (`onesmall-theme.test.ts`). The light
  accent darkens from Chakra `purple.600` to `#6b21a8` to pass.
- Tests emulate the browser's Escape-to-cancel on open modal dialogs (`setupTests.ts`), which jsdom
  lacks, and the `matchMedia` stub is a plain function so mock resets cannot break the theme provider.

## Bundle size (production build, gzip)

|                        | Before (Chakra)                     | After (OneSmallUI)       |
| ---------------------- | ----------------------------------- | ------------------------ |
| JavaScript, all chunks | 317.3 kB                            | 225.0 kB                 |
| CSS                    | 0.4 kB (styles injected at runtime) | 60.3 kB (cacheable file) |
| Entry chunk            | 151.5 kB                            | 96.7 kB                  |

## Validation

- Client unit suite: 80 files, 797 tests passing; typecheck, lint, Prettier and the audit gate pass.
- Automated accessibility (axe WCAG 2.2 A/AA on every route, focus-visible, page structure) and
  the browser smoke run in CI on the pull request.
- Not yet done (needs a person): a screen reader pass with NVDA on Windows and TalkBack on Android
  over sign-in, the app shell and drawer, a task create/edit/delete, a delete dialog, and the theme
  switch; plus a visual review in light and dark at phone and desktop widths. Record the results here.

## Follow-ups

- When `@onesmall/ui` 0.7.0 is published, switch `LinkButton` to `Button as={RouterLink}` and drop
  the click interception, and consider moving icons from `react-icons` to `@onesmall/ui/icons`.
