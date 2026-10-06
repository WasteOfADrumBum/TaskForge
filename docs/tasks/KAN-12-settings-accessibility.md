# KAN-12: Settings and public accessibility

- Jira: https://taskforgejms.atlassian.net/browse/KAN-12
- Branch: `codex/KAN-12-settings-accessibility`
- Source: verified deployed `0452df2` (KAN-10, PR #21).
- Approved milestone: release readiness and bounded Phase 2.

## Acceptance and boundary

1. Visible Settings controls work or appear as clearly planned, noninteractive information.
2. Appearance selection is keyboard accessible, exposes selected state and persists on this device.
3. Landing/sign-in/registration each have one primary heading and logical section headings.
4. Existing hero logo is legible using a suitable token surface without generating or altering assets.
5. Validate keyboard/focus, persistence, heading semantics, contrast and 390/768/1440px behavior.

No account/profile/deletion APIs, production data writes, paid service, hosting/auth changes or design tooling. Existing application patterns only. Original assignment WIP stays untouched. Required checks, independent review, final-head CI, merge and live verification precede Done.

## Inspection

Settings had three inert navigation buttons; appearance selection already used next-themes persistence. Public Heading components defaulted to h2. Existing hero asset has a near-black Task wordmark on a near-black page. Fix the existing implementation within this scope.

## Implementation and QA

Inert Settings navigation is removed; Account and Danger Zone clearly state planned/unavailable functionality. Existing theme buttons expose aria-pressed in a labelled group, with decorative icons hidden. Public headings have one h1 and logical h2 sections. Hero asset remains unchanged on the existing white token surface.

Targeted real-provider tests pass for keyboard selection, persisted localStorage theme and restoration, planned sections and public navigation/headings. Browser keyboard Tab focuses Light with a visible solid outline, Enter selects it, and reload restores the light theme. Settings and landing have no overflow at390/768/1440px; registration has one h1 and no mobile overflow. The existing opaque dark Task wordmark pixels have at least18.43:1 contrast against the white hero surface (sampled source region, no whole-app accessibility certification). Independent production review found no findings. Full local validation passed:875 tests (474 client,401 server), lint, types, both builds and audit0. Final CI and release verification remain.

## Completed release

PR #22 merged as401a7d1fa89b3e253c7a807ae8c3eb69b5c8bdf9. PR CI37463500390/main CI37463871678 passed. Live client headings/logo verified. After the API served the prior commit despite successful deployment, Josh explicitly approved clearing the Render build cache and redeploying this validated main. Corrective deployment dep-db2eptflot8c73eubus0 /6884244726 succeeded; both live release identities matched401a7d1 and health/readiness passed. KAN-12 Done. No config/data/cost changes; the underlying cache discrepancy cause was not proven.
