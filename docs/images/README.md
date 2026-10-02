# Screenshots

README screenshots live in this folder. They are real captures from the production app (https://taskforge-alpha-six.vercel.app), never mockups, and never real personal data.

## Current set

Captured 2026-10-01 from production, using a throwaway `smoke-test-*@example.com` account with realistic sample tasks. That account was removed from production on 2026-10-02.

- **Browser:** Microsoft Edge (Playwright), 1440×900, dark mode, America/New_York time zone.
- **Account:** the sample tasks were deleted after capture. The demo account was not used.

| File                 | Page         | What it shows                                                                              | Status   |
| -------------------- | ------------ | ------------------------------------------------------------------------------------------ | -------- |
| `landing-page.png`   | `/`          | Hero, calls to action, feature cards                                                       | Captured |
| `login.png`          | `/login`     | Sign-in form                                                                               | Captured |
| `command-center.png` | `/home`      | Daily brief, metrics, today's priorities (overdue / due today), rule-based recommendations | Captured |
| `work.png`           | `/work`      | Task form, search and filters, task cards with status, priority, and overdue badges        | Captured |
| `workforce.png`      | `/workforce` | Planned AI Workforce concepts, each labeled "Planned"                                      | Captured |
| `settings.png`       | `/settings`  | Appearance (light / dark / system) inside the app shell                                    | Captured |

**Known gap:** these were captured before the logo crop in PR #7, so the sidebar and header logos in the images are the older, smaller ones. Everything else matches production. Recapturing is a [Phase 1 maintenance item](../roadmap.md#phase-1-maintenance-deferred-does-not-block-phase-1) and does not block anything.

## Recapturing

The safest way is the same as before: use a **throwaway account** on the live app, add sample tasks through the UI, capture, then delete those tasks.

> **Warning:** `npm --workspace server run seed:demo` writes to whatever database `MONGO_URI` points at. It creates or resets the demo user's password and **deletes and replaces** its tasks. Never run it against production unless you have deliberately decided to.

Guidelines:

- PNG, 1440×900 viewport, browser chrome excluded, dark mode for the whole set.
- Reload the page before capturing, so success toasts are gone and the page is scrolled to the top.
- Keep the filenames above, because the root `README.md` references them.
