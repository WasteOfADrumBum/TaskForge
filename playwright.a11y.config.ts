import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// KAN-76: the accessibility sweep runs against its own server. The guarded API caps registrations
// per server run, and the main suite already uses nearly all of them.
// Runs only the accessibility sweep, on a server of its own (the guarded API caps registrations
// per server run). testIgnore is cleared on purpose: the base config ignores this spec.
export default defineConfig({
  ...base,
  testIgnore: undefined,
  testMatch: 'a11y.spec.ts',
});
