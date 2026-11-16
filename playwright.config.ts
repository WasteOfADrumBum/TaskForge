import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  // Runs on its own server with playwright.a11y.config.ts (npm run test:e2e:a11y).
  testIgnore: 'a11y.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/run-browser-environment.mjs',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    timeout: 240000,
  },
});
