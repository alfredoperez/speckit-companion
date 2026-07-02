# Tasks: Activity panel renders the reasoning trail

**Feature**: 385-activity-reasoning-trail · **Plan**: [plan.md](./plan.md) · **Contract**: [contracts/activity-cards.md](./contracts/activity-cards.md)

## Phase 1: Setup

No setup tasks.

## Phase 2: Foundational (blocks all stories)

**Wave 1 — independent (different files):**

- [x] **T001** [P] Core `ViewerState` additions (`ViewerDecision`, `ViewerVerification`, `ViewerCoverageRow`, intent/expectations/classification) + derivation normalizers (`pickDecisions` both-shapes, `pickVerified`, `pickCoverage` map→sorted rows, guarded passthroughs) + unit tests (mixed shapes, malformed skips, legacy identical) · `src/core/types/specContext.ts`, `src/features/spec-viewer/stateDerivation.ts`, `src/features/spec-viewer/__tests__/stateDerivation.test.ts`
- [x] **T002** [P] Webview `ViewerState` mirror of the same fields · `webview/src/spec-viewer/types.ts`
- [x] **T003** [P] Capture side: `--title` on the coverage upsert (non-destructive, composes with `--tasks`/`--tests`) + emission at tasks completion in the tasks node + pytest cases + reassemble commands/goldens · `speckit-extension/scripts/write-context.py`, `speckit-extension/nodes/tasks/tasks-doc.md`, `speckit-extension/tests/test_capture_fields.py`, assembled commands

## Phase 3: User Story 1 — Decisions show again with reasoning (P1)

**Wave 1:**

- [x] **T004** [US1] `DecisionsCard` renders normalized entries with why/rejected detail lines; stories: legacy strings, structured, mixed, long text · `webview/src/spec-viewer/components/cards/DecisionsCard.tsx`, `DecisionsCard.stories.tsx`

**Checkpoint**: the regression is fixed; old specs render as before.

## Phase 4: User Story 2 — Goal and fence (P1)

**Wave 1:**

- [x] **T005** [US2] New `IntentCard` (intent + expectations list) at the top of the panel; compose in `ActivityPanel`; `hasAnyData` gains the four new fields; stories: intent-only, both, absent · `webview/src/spec-viewer/components/cards/IntentCard.tsx`, `IntentCard.stories.tsx`, `webview/src/spec-viewer/components/ActivityPanel.tsx`

## Phase 5: User Story 3 — Verified (P2)

**Wave 1:**

- [x] **T006** [US3] New `VerifiedCard` (what/result/command/warnings; bare strings tolerated); compose; stories incl. warnings + string-entry · `webview/src/spec-viewer/components/cards/VerifiedCard.tsx`, `VerifiedCard.stories.tsx`, `ActivityPanel.tsx`

## Phase 6: User Story 4 — Coverage (P2)

**Wave 1:**

- [x] **T007** [US4] New `CoverageCard` (per-req title — tasks — tests, covered/total rollup header); compose; stories: with titles, ids-only, partial coverage · `webview/src/spec-viewer/components/cards/CoverageCard.tsx`, `CoverageCard.stories.tsx`, `ActivityPanel.tsx`

## Phase 7: User Story 5 — Classification line (P3)

**Wave 1:**

- [x] **T008** [US5] `ApproachCard` shows `verdict · N files / M tasks projected (signal)` when classification present; add stories (none exist) covering with/without classification · `webview/src/spec-viewer/components/cards/ApproachCard.tsx`, `ApproachCard.stories.tsx`

## Phase 8: Design critique gate

**Wave 1:**

- [x] **T009** Critique the assembled panel against the design-taste principles (hierarchy, no duplicate representations, whitespace, minimalism) + the repo webview invariants (injection, sr-only, ellipsis trio); apply accepted findings to the cards/styles in-change · `webview/src/spec-viewer/components/cards/*`, `webview/styles/spec-viewer/*`

## Phase 9: Polish

**Wave 1 — independent (different files):**

- [x] **T010** [P] Docs + release notes: README Reading Specs blurb, `docs/spec-context-schema.md` coverage-title row, `docs/capture-and-timing.md` WHEN-map tweak, root CHANGELOG (viewer), spec-kit ext CHANGELOG (--title) · `README.md`, `docs/`, `CHANGELOG.md`, `speckit-extension/CHANGELOG.md`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T011** Full gate: `npm test`, `npm run compile`, python suite, assembly parity; validate SC-001…SC-004 (incl. opening 384's context against the new derivation) · repo root

## Dependencies & Execution Order

- Foundational (T001–T003, one parallel wave) blocks all stories: cards render what T001 derives; T003 is independent plumbing that T007's titles consume.
- Story tasks T004–T008 each touch their own card (+ shared `ActivityPanel` in T005–T007 — sequential in that order to avoid same-file collisions).
- T009 (critique) requires all cards built; T010/T011 close.
