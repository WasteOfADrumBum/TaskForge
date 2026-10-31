<!-- one-small-engineering:continuity v1 -->

## Engineering Hub continuity (v1)

This project is governed by https://github.com/WasteOfADrumBum/one-small-engineering. The full contract is `standards/agent-continuity.md` there. In short:

- **Start:** read this file, `.engineering/HANDOFF.md` and `.engineering/state.json`. Then check GitHub (branch head, open PRs, CI) against the recorded commit. If they disagree, trust GitHub and say so. Look for another agent's active task before starting your own.
- **During:** keep tasks small, run the relevant tests, and checkpoint after each finished task or decision. Do not put secrets in `.engineering/`.
- **Hand off or finish:** write a checkpoint (`node <hub>/scripts/state/cli.mjs checkpoint ...`, or edit `state.json` by the schema, bump `revision`, and regenerate the two views). Record what is done, what remains, branch and SHA, tests run and failed, blockers, decisions, the exact next step, and whether uncommitted work exists outside the checkpoint.
- **Never:** record a human verification, approval or release decision; claim tests you did not run; treat a previous agent's notes as verified. Release approval belongs to Joshua Small.

<!-- /one-small-engineering:continuity -->
