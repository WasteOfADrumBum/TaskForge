# Screenshots

README screenshots live in this folder. Capture them using a demo account with realistic sample data, never real personal data.

> **Warning:** `npm --workspace server run seed:demo` writes to whatever database `MONGO_URI` points at. It creates or resets the demo user's password and **deletes and replaces** its tasks. Run it against a local or development database and capture screenshots from `npm run dev`, or, on the live app, add sample tasks by hand through the UI. Do not run the seed script against production without deliberately deciding to.

| File               | Page        | What to show                                                            | Status       |
| ------------------ | ----------- | ----------------------------------------------------------------------- | ------------ |
| `landing-page.png` | `/`         | Hero, feature cards, "Built with" section                               | Not captured |
| `login.png`        | `/login`    | Sign-in form                                                            | Not captured |
| `dashboard.png`    | `/home`     | Command Center: metrics, today's priorities, rule-based recommendations | Not captured |
| `settings.png`     | `/settings` | Appearance (light / dark / system) panel                                | Not captured |

Guidelines:

- PNG, about 1440px wide, browser chrome cropped out.
- Use the same theme (light or dark) for the whole set.
- Once the files are added here, add them to the **Screenshots** section of the root `README.md` and update the status in `docs/project-status.md`.
