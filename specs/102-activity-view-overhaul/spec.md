# Spec: Activity View Overhaul

**Slug**: 102-activity-view-overhaul | **Date**: 2026-05-21

## Summary

The viewer's Activity tab and the `.spec-context.json` data behind it are quietly
broken in several related ways: completion timestamps never finalize, durations read
as `<1s`, the Implement phase repeats a generic `phase1` label forever, the author
badge repeats as noise on every row, the PHASES card hides timing it already has,
skill-authored fields slip through the schema undeclared, and the Activity tab still
shows the previously-selected tab's sub-navigation. This overhaul fixes the
spec-context data pipeline (correctness + timing), makes the PHASES timeline
trustworthy and meaningful with an `impeccable` restyle, and hides the stale sub-nav.

## Requirements

### A. Spec-context data correctness (extension)

- **R001** (MUST): When a spec reaches a terminal state (`currentStep: done` or
  `status: completed | archived`), the last step's `stepHistory[...].completedAt` MUST
  be finalized from the last transition's `at`, never left `null`.
- **R002** (MUST): Derived `stepHistory` `startedAt`/`completedAt` MUST come from real
  transition `at` values; the derivation MUST NOT fall back to a single shared
  "written now" timestamp that makes `end − start = 0` (the `<1s` bug).
- **R003** (MUST): A one-time legacy backfill MUST fill null/absent step `completedAt`
  for pre-logging specs that have no usable step timing, using the best available
  source (git history or file mtime), without corrupting specs that already have valid
  timing.
- **R004** (MUST): The Implement substep label MUST advance through meaningful values
  (task range / phase / `hooks` / `code-review`, as spec `099` already does) instead of
  repeating the generic `phase1`.
- **R005** (MUST): Consecutive identical `(step, substep)` transitions MUST NOT be
  written. Distinct substeps emitted within the same turn are preserved; only exact
  back-to-back duplicates are dropped.
- **R006** (SHOULD): The derivation/reconciler SHOULD stop emitting minute-rounded
  synthetic `at` values; carry the source `at` or omit it rather than synthesizing a
  rounded timestamp.

### B. PHASES timeline display (webview)

- **R007** (MUST): Phase durations MUST render from the corrected `stepHistory` so no
  completed phase shows `<1s` when real elapsed time exists.
- **R008** (MUST): Each substep row MUST show its timing, using the existing
  `formatStepOffset` (offset from the group's start) or `formatDuration` (for substeps
  with a tracked `completedAt`).
- **R009** (MUST): The PHASES card MUST show a card-level header with the spec's overall
  **started** (first group's `startedAt`), **ended** (last group's `completedAt`), and
  **total** duration.
- **R010** (MUST): Consecutive identical `(step, substep)` rows MUST be de-duplicated in
  the rendered timeline (defense in depth alongside R005).
- **R011** (MUST): The author (`by`) badge MUST appear only on the first (spec-start)
  transition, not on every per-substep row.
- **R012** (SHOULD): Relative "Xm ago" SHOULD appear only on the currently in-flight
  step; completed steps show only their duration; the overall absolute start/end lives
  in the new header (R009).
- **R013** (SHOULD): The card SHOULD receive an `impeccable` restyle, exploring a
  horizontal timeline layout in place of the current vertical list, with supporting CSS
  in `webview/styles/spec-viewer/` for the substep-time row, card header, and layout.

### C. Activity tab sub-navigation (webview)

- **R014** (MUST): While the Activity tab is selected, the sub-document (sub-navigation)
  tab row MUST be hidden; switching back to a content tab MUST restore that tab's
  correct sub-nav.

### D. Schema declaration (extension)

- **R015** (MUST): `specContext.ts` and `spec-context.schema.json` MUST declare the
  viewer-relevant skill-authored fields (`last_action`, `task_summaries`,
  `step_summaries`) as optional, with ownership comments; remaining drift fields stay
  tolerated as extras (`additionalProperties: true` preserved).
- **R016** (SHOULD): The transition `by` enum in the schema SHOULD be reconciled with
  the runtime type so the real authored values (`sdd`, `ai`) validate instead of only
  `extension | user | cli`.

## Scenarios

### Completed spec shows real per-phase timing

**When** a user opens the Activity tab for a finished spec (e.g. `101`)
**Then** every completed phase shows a real duration (minutes/seconds), no phase shows
an impossible `<1s`, and the last (terminal) phase shows a finalized end time rather
than running forever.

### Implement phase reads as meaningful substeps

**When** a user views the PHASES card for a spec that ran `/sdd:implement`
**Then** the Implement phase lists distinct, meaningful substeps (task ranges, `hooks`,
`code-review`) instead of `phase1` repeated several times, and no consecutive duplicate
rows appear.

### Overall timeline header

**When** the PHASES card renders for any spec with at least one timed phase
**Then** a header shows the overall started time, ended time (or in-flight), and total
elapsed duration for the whole spec.

### Author badge is shown once

**When** the timeline renders multiple substeps authored by the same actor
**Then** the `by` badge appears only on the spec-start transition, not repeated on each
substep row.

### Switching to and from the Activity tab

**When** a user selects the Activity tab from a content tab that had a sub-document row
**Then** the sub-navigation row disappears while Activity is shown, and reappears
correctly for the original tab when the user switches back.

### Legacy specs without timing

**When** the viewer opens a pre-logging spec that never recorded step timing
**Then** the one-time backfill has populated best-effort `completedAt` values so phases
render durations rather than blanks, and specs with already-valid timing are unchanged.

### Skill-authored fields validate

**When** a `.spec-context.json` carrying `last_action`, `task_summaries`, or
`step_summaries` is validated against the schema
**Then** those fields validate as declared optional properties, and a transition with
`by: "sdd"` or `by: "ai"` also validates.

## Non-Functional Requirements

- **NFR001** (MUST): The legacy backfill (R003) MUST be idempotent and non-destructive —
  re-running it leaves already-correct timing untouched and never overwrites a real
  transition timestamp with a synthesized one.
- **NFR002** (SHOULD): PHASES card rendering SHOULD remain a pure read over derived data
  (no writes triggered by viewing the Activity tab).

## Out of Scope

- SDD/SpecKit `SKILL.md` changes (the millisecond-timestamp fix already shipped to
  `~/dev/GitHub/sdd`).
- A full per-substep author-attribution model — only the spec-start author is surfaced.
- Declaring the remaining drift fields (`next`, `approach`, `progress`, `currentTask`,
  `createdAt`, `updated`, `files_modified`) — these stay tolerated, not declared.
- Reworking how transitions are recorded beyond the two writer fixes (R004, R005).
