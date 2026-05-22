# Tasks: Activity View Overhaul

**Plan**: [plan.md](./plan.md)

> Format reference: `[P]` markers and parallel groups — see `skills/tasks/SKILL.md` § Phase rules.

## Phase 1: Core Implementation

- [x] **T001** [P] De-dup guard in `appendTransition` — `src/features/specs/specContextWriter.ts` | R005
  - **Do**: In `appendTransition`, before pushing, compare the incoming transition's `(step, substep)` to the last entry in `ctx.transitions`; if both `step` and `substep` are identical, return `ctx` unchanged (drop the duplicate). Distinct substeps within a turn are preserved.
  - **Verify**: `npm run compile` passes; new unit test (T009) shows a consecutive identical `(step, substep)` is dropped and a distinct one is kept.
  - **Leverage**: existing `appendTransition` body (`specContextWriter.ts:92`).

- [x] **T002** [P] Terminal-finalize + collapse-identical in `deriveStepHistory` — `src/features/specs/stepHistoryDerivation.ts` | R001, R002, R010
  - **Do**: (1) Add a `status?: Status` (or `completed?: boolean`) parameter; when the last-seen step `isCurrent` AND the spec is in a terminal status (`completed` | `archived`), set its `completedAt` to the last transition's `at` instead of `null`. (2) Before grouping, collapse consecutive identical `(step, substep)` transitions so duplicates don't distort durations/substep lists. Keep `startedAt`/`completedAt` from real transition `at` values.
  - **Verify**: build passes; T009 tests cover terminal finalize, collapse, and non-zero durations from distinct `at`.
  - **Leverage**: `groupStepsInOrder` / `buildSubsteps` in the same file.

- [x] **T003** [P] Legacy backfill rewrite in reconciler — `src/features/specs/specContextReconciler.ts` | R003, R006
  - **Do**: Replace the `now`-stamped fills (lines ~76–88) so missing `completedAt` is filled from a best-available real source (spec/plan/tasks file mtime; fall back to leaving absent) rather than `new Date().toISOString()`. Fill only genuinely-missing values; never overwrite an existing real timestamp; never synthesize minute-rounded `at`. Keep idempotent + non-destructive (NFR001).
  - **Verify**: build passes; T009 tests show re-running leaves correct timing untouched, fills only missing `completedAt`, and uses no synthetic rounded times.
  - **Leverage**: existing `reconcile()` backfill loop.

- [x] **T004** [P] Declare skill-authored schema fields + reconcile `by` enum — `src/core/types/specContext.ts`, `src/core/types/spec-context.schema.json` | R015, R016
  - **Do**: In `specContext.ts`, add optional `last_action`, `task_summaries`, `step_summaries` fields to `SpecContext` with ownership comments (skill-authored, viewer-relevant). In `spec-context.schema.json`, add those three as optional properties and extend the transition `by` enum to `["extension","user","cli","sdd","ai"]`. Keep `additionalProperties: true`.
  - **Verify**: build + type-check pass; a `.spec-context.json` with those fields and `by: "sdd"`/`"ai"` validates against the schema.
  - **Leverage**: existing `SpecContext` index signature + `$defs/transition`.

- [x] **T005** [P] Hide Activity sub-nav row — `webview/src/spec-viewer/components/NavigationBar.tsx`, `webview/styles/spec-viewer/_navigation.css` | R014
  - **Do**: When `activityVisible.value` is true, do not render the `step-children` sub-nav row; restore it (existing logic) when Activity is toggled off. Add supporting CSS only if needed.
  - **Verify**: build passes; toggling Activity hides the sub-document row and switching back restores the prior tab's sub-nav.
  - **Leverage**: `activityVisible` signal already imported in `NavigationBar.tsx`; `showChildrenRow` gate.

- [x] **T006** Wire spec `status` into derivation — `src/features/spec-viewer/stateDerivation.ts` *(depends on T002)* | R001
  - **Do**: Pass `ctx.status` (or completion flag) into `deriveStepHistory(ctx.transitions, ctx.currentStep, ...)` at line ~221 so the terminal-step finalize fires for the viewer.
  - **Verify**: build passes; a completed spec's last phase shows a finalized end time, not in-flight forever.
  - **Leverage**: `stateDerivation.ts:221` call site.

- [x] **T007** Re-render PHASES card (header, per-substep timing, de-dup, author-at-start, in-flight ago) — `webview/src/spec-viewer/components/cards/PhasesCard.tsx` *(depends on T002, T006)* | R007, R008, R009, R010, R011, R012
  - **Do**: Add a card-level header showing overall started / ended / total (`formatDuration` over first group `startedAt` → last group `completedAt`). Render per-substep timing on each event row (`formatStepOffset(group.startedAt, event.startedAt)`, or `formatDuration` for tracked substeps). De-duplicate consecutive identical `(step, substep)` rows. Show the `by` badge only on the first spec-start transition; drop it from per-substep rows. Limit relative "Xm ago" to the in-flight step; completed steps show duration only. Restructure markup for a horizontal timeline layout.
  - **Verify**: build passes; stories (T010) show header, per-substep times, single author badge, no duplicate rows, no `<1s` on real elapsed time.
  - **Leverage**: `formatStepOffset`/`formatDuration`/`formatRelativeTime` in `relativeTime.ts`; `mergeStepEvents` in `timelineEvents.ts`.

- [x] **T008** `impeccable` styling for header / substep-time row / horizontal layout — `webview/styles/spec-viewer/_activity.css` *(depends on T007)* | R013
  - **Do**: Style the new card header, per-substep time row, and horizontal timeline layout using VS Code theme variables; apply an `impeccable` pass (spacing, hierarchy, alignment).
  - **Verify**: build passes; the PHASES card renders as a polished horizontal timeline in the Activity tab.
  - **Leverage**: existing `.phases-step` / `.activity-card` rules in `_activity.css`.

- [x] **T009** [P] Extension unit tests — `src/features/specs/__tests__/stepHistoryDerivation.test.ts`, `specContextReconciler` + `specContextWriter` tests *(depends on T001, T002, T003)* | R001, R002, R003, R005, R006
  - **Do**: Add/extend Jest tests: terminal finalize on `completed`/`archived`; collapse consecutive identical transitions; non-zero durations from distinct `at`; reconciler idempotent + fills only missing `completedAt` + no synthetic rounded `at`; `appendTransition` drops consecutive identical and keeps distinct.
  - **Verify**: `npm test` passes.
  - **Leverage**: existing `stepHistoryDerivation.test.ts` BDD structure.

- [x] **T010** [P] PhasesCard story fixtures — `webview/src/spec-viewer/components/cards/PhasesCard.stories.tsx` *(depends on T007)* | R007, R008, R009, R010, R011, R012
  - **Do**: Add stories for overall header, per-substep timing, duplicate-row collapse (`phase1 ×N`), author-at-start, in-flight "ago", and a terminal-finalized completed spec.
  - **Verify**: stories render; visual review of the horizontal layout.
  - **Leverage**: existing `PhasesCard.stories.tsx` fixtures (already has a `phase1`/`code-review` implement case).
