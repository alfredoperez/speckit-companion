# Tasks: The pull request carries the receipts

## Phase 1: Setup

None.

## Phase 2: User Story 1 - Print the receipts (P1)

Files: `apps/speckit-extension/scripts/receipts.py`, `apps/speckit-extension/tests/test_receipts.py`, `apps/speckit-extension/scripts/package-manifest.py`, `.vscodeignore`

- [x] **T001** [US1] `receipts.py`: table from `verified[]`, claimed and stale rows, mutation, review depth, assumed requirements; escaping; never fails · receipts.py
- [x] **T002** [US1] Ship it: RUNTIME_SCRIPTS, VSIX_ROOTS, `!` rule · package-manifest.py, .vscodeignore
- [x] **T003** [US1] Tests: each row kind, escaping, empty record, stale check in a git sandbox · test_receipts.py

## Phase 3: User Story 2 - Put them in the PR and document (P1)

Files: `apps/speckit-extension/nodes/implement/record-verified.md`, `apps/speckit-extension/commands/speckit.companion.implement.md`, `.specify/companion.yml`, `apps/website/src/content/docs/docs/results/the-overview.mdx`

- [x] **T004** [US2] Record node: paste the receipts into the PR body unedited; rebuild · record-verified.md
- [x] **T005** [US2] This repo's PR hook includes the receipts · .specify/companion.yml
- [x] **T006** [US2] Overview page: request quote, decision authors, Assumed, Weak, stale checks, review depth, receipts · the-overview.mdx

## Phase 4: Polish

- [x] **T007** Changelog lines
- [x] **T008** Validate: `tsc`, Jest, canvas and Python suites, build check, budget, emissions, manifest

## Dependencies & Execution Order

T001 before T002 and T003; Phase 3 after T001; Polish last.
