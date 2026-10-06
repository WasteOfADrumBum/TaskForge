# Isolated integration and browser checks

Run from the repository root on Windows/PowerShell or CI:

```powershell
npm ci
npm run test:qa-safety
npm run test:integration
npx playwright install chromium
npm run test:e2e
```

First database/browser execution downloads official test binaries into local caches. Subsequent runs reuse binaries but always create a fresh real MongoDB process/database and unique synthetic accounts. No Docker service, Atlas account, .env file or production credentials are required. Linux CI installs Chromium's system dependencies with `npx playwright install --with-deps chromium`.

`npm test` remains the fast client/server unit suite. `npm run lint` and `npm run typecheck` also validate the QA files. The protected CI quality job runs all required checks, then real database integration and browser smoke. A failing critical flow prevents that required job from passing.

Use the managed root command rather than pointing the server workspace command at a manually managed database. The raw workspace integration command requires an explicit credential-free loopback TEST_MONGO_URI with a fresh taskforge_qa_ namespace and refuses existing collections. It never resets or drops data. The browser environment likewise owns its local API/client/database and refuses server reuse. It waits for its own API child to confirm a successful listening event through private IPC before starting Vite; it fails without sending requests when the API port is occupied. Do not adapt these scripts to production URLs.

```powershell
npm run test:integration -- --testNamePattern="isolates tasks lists"
npm run test:e2e -- --grep "persists assigned task"
```

Failure traces stay under ignored `test-results/`; inspect locally. They contain synthetic test state and should not be mixed with production credentials. Coverage boundaries and the representative ownership failure proof are recorded in [KAN-13](tasks/KAN-13-integration-smoke.md). No production backup/restore, Atlas or load-test guarantee is made.

Runtime reference: [MongoDB process manager quick start](https://typegoose.github.io/mongodb-memory-server/docs/guides/quick-start-guide/).
