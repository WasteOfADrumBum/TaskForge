# Application screenshots

These are real application captures, using only synthetic local data. They are not mockups, and no production account or records were created, changed or removed for this capture.

## Current set

Captured 2026-10-06 from the verified release source `3a8e3c5c1ccda79b124c28ba706e2838bfdf9db3` (KAN-13, PR #23). The live client/API release identities matched this commit before capture. The local harness imports the same application code and owns a fresh loopback-only MongoDB/API/client environment.

- Playwright Chromium; 1440×900 viewport, full-page PNGs, dark mode, America/New_York.
- Synthetic fixture: 6 tasks, 2 projects, 3 agent definitions. No personal, employer, FEMA or private career content.
- Source/time/routes are recorded in [capture metadata](capture-metadata.json). The agent detail ID belongs only to the disposable local fixture.
- The earlier October1 production captures are superseded. This workflow does not repeat their production account/data operations.

| File               | Page           | Shows                                                                             |
| ------------------ | -------------- | --------------------------------------------------------------------------------- |
| landing-page.png   | /              | Current hero/logo, public heading and calls to action                             |
| login.png          | /login         | Empty sign-in form; no credentials                                                |
| command-center.png | /home          | Rule-based brief, metrics, projects and assignment summary                        |
| work.png           | /work          | Task form, filters, assignments and paused-agent badge                            |
| projects.png       | /work/projects | Actual private project registry and progress                                      |
| workforce.png      | /workforce     | Saved agent definitions and assignment workload; execution explicitly unavailable |
| agent-detail.png   | /workforce/:id | Assigned tasks, definition metadata and clearly planned runs/approvals            |
| settings.png       | /settings      | Working appearance selection and clearly planned account features                 |

## Safe recapture

Use the isolated environment described in [testing](../testing.md), populate a fresh local account with synthetic records, and capture the real pages. Verify the source against the served release metadata, wait for data/fonts to load, clear transient toasts, and exclude browser chrome. Keep existing filenames referenced by the README.

Never point capture fixtures at production, load production credentials, or seed/reset an existing database. The root harness verifies its owned API listener before Vite starts and refuses pre-existing database collections/server reuse. Stop only the capture workflow's own processes afterward.

Agent definitions, assignment counts and permission identifiers shown here do not prove AI execution or permission enforcement. Those Phase 2 features are still planned. These captures support release evidence; they do not establish exhaustive visual/accessibility, cross-browser, production backup or Atlas recovery guarantees.
