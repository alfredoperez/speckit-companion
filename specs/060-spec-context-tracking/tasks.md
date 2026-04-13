---
description: "Task list for Spec-Context Tracking & Viewer Status Feedback"
---

# Tasks: Spec-Context Tracking & Viewer Status Feedback

**Input**: Design documents from `/specs/060-spec-context-tracking/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/spec-context.schema.json, quickstart.md

**Tests**: Included — spec defines SC-001..SC-006 measurable outcomes and plan enumerates `tests/unit/*` and `tests/integration/*` suites.

**Organization**: Grouped by user story (US1–US7) for independent delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1..US7 mapping to spec.md user stories

## Path Conventions

Single VS Code extension. Extension code under `src/`, webview under `webview/src/`, tests under `tests/`, prompt skills under `.claude/skills/`.

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Create directory scaffolding: `src/core/types/`, `src/features/specs/`, `src/features/spec-viewer/`, `tests/unit/specs/`, `tests/unit/spec-viewer/`, `tests/integration/` (create missing dirs only)
- [X] T002 [P] Copy canonical JSON Schema from `specs/060-spec-context-tracking/contracts/spec-context.schema.json` into `src/core/types/spec-context.schema.json` for runtime validation
- [X] T003 [P] Add schema fixture files `tests/fixtures/spec-context/054.json`, `055.json`, `056.json`, `058.json` mirroring the four sample specs described in spec.md Problem Context

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, reader/writer, and derivation scaffolding used by every user story.

**⚠️ CRITICAL**: All user story phases depend on this phase.

- [X] T004 Define canonical types (`SpecContext`, `StepName`, `Status`, `StepHistoryEntry`, `SubstepEntry`, `Transition`, `FooterAction`, `ViewerState`, `StepBadgeState`) in `src/core/types/specContext.ts` per data-model.md
- [X] T005 Implement `readSpecContext(uri)` in `src/features/specs/specContextReader.ts` — parse JSON, tolerate unknown fields (FR-013), return typed `SpecContext` or `null` when missing
- [X] T006 Implement `writeSpecContext(uri, ctx)` in `src/features/specs/specContextWriter.ts` — read-modify-write with temp-file + atomic rename, preserve unknown top-level fields, enforce append-only semantics on `transitions` (FR-005, FR-012, FR-013)
- [X] T007 [P] Implement helpers `appendTransition(ctx, t)`, `setStepStarted(ctx, step, by)`, `setStepCompleted(ctx, step, by)`, `setSubstepStarted/Completed(ctx, step, substep, by)` in `src/features/specs/specContextWriter.ts` — pure functions that mutate a draft and enforce status transitions from data-model.md
- [X] T008 Implement `backfillMinimalContext({workflow, specName, branch})` in `src/features/specs/specContextBackfill.ts` — returns `{workflow, specName, branch, currentStep: "specify", status: "draft", stepHistory: {}, transitions: []}` per Decision 3 / FR-011; never infers step completion
- [X] T009 Wire viewer open path to call `backfillMinimalContext` when `.spec-context.json` is missing, write via `specContextWriter` (modify existing viewer-open handler under `src/features/spec-viewer/` — locate and update; do not read file presence to mark steps)

**Checkpoint**: Reader/writer/backfill are usable; user stories can proceed in parallel.

---

## Phase 3: User Story 1 — Trustworthy single spec status (P1) 🎯 MVP

**Goal**: Sidebar, header, and stepper all display one spec-wide `status` value, consistent across tab switches.

**Independent Test**: Open any spec. Sidebar label, header badge, overall stepper all show same status; switching tabs does not change it.

### Tests for US1

- [X] T010 [P] [US1] Unit test `tests/unit/spec-viewer/stateDerivation.spec.ts`: `deriveViewerState` returns a single `status` derived only from `ctx.status` (no per-tab variance) — covers acceptance 1, 2, 3
- [X] T011 [P] [US1] Unit test: when `ctx.status === "completed"`, `pulse === null` and all `stepHistory` entries with `completedAt` appear in `highlights`

### Implementation for US1

- [X] T012 [US1] Implement `deriveViewerState(ctx): ViewerState` in `src/features/spec-viewer/stateDerivation.ts` per data-model.md "Derived view models" (status passthrough, pulse rules, highlights)
- [X] T013 [US1] Update sidebar provider to render `ctx.status` directly — locate tree provider under `src/features/specs/` and replace any per-step/file-existence logic with `ctx.status` label lookup
- [X] T014 [US1] Update spec viewer header badge renderer under `webview/src/spec-viewer/` to consume `ViewerState.status` (invariant across tab selection); remove any code that recomputes badge from active tab
- [X] T015 [US1] Update stepper "overall" rendering in `webview/src/spec-viewer/` to read `ViewerState.status` rather than per-step inference

**Checkpoint**: US1 passes its independent test.

---

## Phase 4: User Story 2 — Step progression driven by explicit events (P1)

**Goal**: Stepper advances only when `stepHistory` has explicit `startedAt`/`completedAt`; file existence is ignored.

**Independent Test**: Create empty/template `plan.md` without running plan step → Plan badge reads "Not started".

### Tests for US2

- [X] T016 [P] [US2] Unit test `tests/unit/spec-viewer/stateDerivation.spec.ts`: with `plan.md` present on disk but no `stepHistory.plan` entry, derived `steps.plan === "not-started"` (covers acceptance 1 & 3)
- [X] T017 [P] [US2] Unit test: `startedAt` set + `completedAt` null ⇒ `"in-progress"`; both set ⇒ `"completed"` (acceptance 2)

### Implementation for US2

- [X] T018 [US2] In `src/features/spec-viewer/stateDerivation.ts`, implement `deriveStepBadges(ctx): Record<StepName, StepBadgeState>` using only `stepHistory` (FR-007)
- [X] T019 [US2] Remove/replace any file-existence checks for step state in `src/features/specs/` and `src/features/spec-viewer/` — grep for references to `plan.md`/`tasks.md` existence and route through `stateDerivation`
- [X] T020 [US2] Update webview stepper renderer in `webview/src/spec-viewer/` to consume `ViewerState.steps[step]` exclusively

**Checkpoint**: Template files no longer cause false progress.

---

## Phase 5: User Story 3 — Consistent context across workflows (P1)

**Goal**: All four workflows produce the same `.spec-context.json` shape.

**Independent Test**: Diff `.spec-context.json` after running each workflow on a scratch spec — key set identical.

### Tests for US3

- [X] T021 [P] [US3] Integration test `tests/integration/specContextWorkflows.spec.ts`: validate fixtures `054.json`, `055.json`, `056.json`, `058.json` against `src/core/types/spec-context.schema.json` using ajv (SC-001)
- [X] T022 [P] [US3] Unit test `tests/unit/specs/specContext.spec.ts`: writer preserves unknown top-level fields across a round-trip (FR-013)
- [X] T023 [P] [US3] Unit test: `transitions` is append-only — writer rejects mutations to existing entries and appends new ones (FR-005, FR-012)

### Implementation for US3

- [X] T024 [US3] Implement JSON Schema validation helper `validateSpecContext(ctx)` in `src/features/specs/specContextReader.ts` using ajv against `src/core/types/spec-context.schema.json`; log (not throw) on invalid inbound files to remain tolerant
- [X] T025 [US3] Add migration shim `normalizeSpecContext(raw)` in `src/features/specs/specContextReader.ts` that coerces legacy shapes (e.g. `{status: "completed"}` only) into canonical shape with empty `stepHistory`/`transitions` arrays (covers 055/058 cases)
- [X] T026 [US3] Ensure `specContextWriter` atomic rename works on Windows (use `fs.promises.rename` with fallback to `fs.renameSync` retry) — verify in writer module

**Checkpoint**: All four workflow fixtures validate; shape is uniform.

---

## Phase 6: User Story 7 — Reactive prompts update context (P3, implements US2/US3/US4 mechanics)

**Goal**: Every step records `startedAt`/`completedAt` and transitions.

> **Scope change (post-planning):** The installed SpecKit Companion
> extension ships only packaged `src/` code. It does NOT ship
> `.claude/**` or `.specify/**` — those are user-local AI/CLI setup.
> Context-update behavior must therefore live in extension code:
>
> - **Option A (hard guarantee):** extension command handlers
>   (`src/features/specs/specCommands.ts`, viewer message handlers) call
>   `specContextWriter.setStepStarted/Completed` directly around each
>   step launch. Tracked as a follow-up spec.
> - **Option B (soft):** the extension prepends a context-update
>   instruction to the prompt text it dispatches via
>   `executeInTerminal(prompt)` in `ai-providers/*`. Tracked as a
>   follow-up spec.
>
> Both are out of scope for spec 060 — this spec delivers the
> reader/writer/backfill/derivation foundation that Options A and B will
> use.

### Tests for US7

- [X] T027 [P] [US7] Integration test `tests/integration/specContextWorkflows.spec.ts`: simulate a specify→plan→tasks run by invoking helpers from T007 in order; assert final context has `startedAt`+`completedAt` for all three steps and at least 6 transitions

### Implementation for US7 (revised scope)

- [~] T028 — REVERTED: shared skill-prompt block at `.claude/skills/_shared/*` (dev-only surface; not shipped).
- [~] T029–T034 — REVERTED: `.claude/skills/speckit-*/SKILL.md` edits (dev-only surface; not shipped).
- [~] T028'  — REVERTED: `.specify/templates/spec-template.md` edit (user-local SpecKit CLI surface; not shipped).
- [~] T035 — OUT OF SCOPE: `.claude/skills/sdd*/SKILL.md` live in the SDD repo.
- **Deferred** to follow-up specs: Option A (extension command-handler lifecycle writes) and Option B (prepend to dispatched prompt text) — see phase note above.

**Checkpoint**: All prompts standardized; workflow runs leave complete lifecycle data.

---

## Phase 7: User Story 4 — Substep tracking (P2)

**Goal**: Record substeps (`specify.validate-checklist`, `plan.research`, etc.) in `stepHistory.<step>.substeps` and `transitions`.

**Independent Test**: Companion specify run records at least one substep in `stepHistory.specify.substeps` and in `transitions`.

### Tests for US4

- [X] T036 [P] [US4] Unit test `tests/unit/specs/specContext.spec.ts`: `setSubstepStarted`/`setSubstepCompleted` append substep entries and emit transitions with non-null `substep`
- [X] T037 [P] [US4] Unit test: `deriveViewerState` surfaces active substep label when current step has an in-progress substep (acceptance 2)

### Implementation for US4

- [X] T038 [US4] Extend `deriveViewerState` to include `activeSubstep: {step, name} | null` on `ViewerState` (`src/features/spec-viewer/stateDerivation.ts`)
- [X] T039 [US4] Update stepper in `webview/src/spec-viewer/` to render substep label ("Specifying · validating checklist") when `activeSubstep` is set
- [X] T040 [P] [US4] Document canonical substep names in `.claude/skills/_shared/spec-context-update.md` (`specify.outline`, `specify.validate-checklist`, `plan.research`, `plan.design`, `tasks.generate`, `implement.run-tests`) and reference them from each skill's context-update block

**Checkpoint**: Substeps visible in viewer for Companion runs.

---

## Phase 8: User Story 5 — Correct visual indicators (P2)

**Goal**: Pulse on active step only; green highlight on completed steps only; no pulse when `status ∈ {completed, archived}`.

**Independent Test**: Walk Draft→Completed transitions; pulse/highlight always match.

### Tests for US5

- [X] T041 [P] [US5] Unit test `tests/unit/spec-viewer/stateDerivation.spec.ts`: `pulse === null` when `status` is `completed` or `archived` (FR-008)
- [X] T042 [P] [US5] Unit test: pulse equals the single step with `startedAt` set and `completedAt` null; highlights equals the set of steps with `completedAt` set (FR-007, FR-008)

### Implementation for US5

- [X] T043 [US5] Ensure `deriveViewerState.pulse` and `.highlights` implement the rules above in `src/features/spec-viewer/stateDerivation.ts`
- [X] T044 [US5] Update step-tab renderer in `webview/src/spec-viewer/` to toggle pulse class from `ViewerState.pulse`; remove any legacy per-tab pulse logic
- [X] T045 [US5] Update CSS in `webview/styles/spec-viewer/` (locate stepper partial) to ensure pulse animation only applies when the pulse class is present, and completed-highlight style applies independently of the selected tab

**Checkpoint**: Pulse/highlight correctness verified across Draft→Completed walkthrough.

---

## Phase 9: User Story 6 — Scoped footer actions (P2)

**Goal**: Footer buttons declare `spec`/`step` scope, render scope-stating tooltips, and are visibility-gated per step and status.

**Independent Test**: Hover each footer button on each step — tooltip names scope; visibility matches rules (e.g. SDD Auto only on Specify tab during Draft/Specifying).

### Tests for US6

- [X] T046 [P] [US6] Unit test `tests/unit/spec-viewer/footerActions.spec.ts`: `getFooterActions(ctx, step)` filters by `visibleWhen`; tooltip contains "Affects whole spec" or "Affects this step" matching `scope` (FR-009)
- [X] T047 [P] [US6] Unit test: SDD Auto button visible only when `workflow ∈ {sdd, sdd-fast}`, `step === "specify"`, and `status ∈ {draft, specifying}` (FR-010)
- [X] T048 [P] [US6] Unit test: Regenerate hidden when step has no `startedAt` (acceptance 4)

### Implementation for US6

- [X] T049 [US6] Create `src/features/spec-viewer/footerActions.ts` exporting the `FooterAction[]` catalog (Archive, Regenerate, Start, Auto, etc.) with `{id, label, scope, visibleWhen, tooltip}` and a `getFooterActions(ctx, step)` selector
- [X] T050 [US6] Update footer renderer in `webview/src/spec-viewer/` to iterate `ViewerState.footer` and render `<button title={tooltip}>`; remove inline visibility logic
- [X] T051 [US6] Wire `ViewerState.footer = getFooterActions(ctx, activeStep)` into `deriveViewerState` (`src/features/spec-viewer/stateDerivation.ts`)

**Checkpoint**: All footer buttons show scope tooltips; Auto button visibility constrained.

---

## Phase 10: Polish & Cross-Cutting

- [X] T052 [P] Update `README.md` with a "Spec Context" section describing the canonical `.spec-context.json` schema and the status vocabulary
- [X] T053 [P] Update `docs/viewer-states.md` to reflect the new status-driven badge/pulse/highlight rules and footer scope tooltips
- [X] T054 [P] Update `docs/architecture.md` to mention `specContextReader`/`specContextWriter`/`specContextBackfill` and `stateDerivation` modules
- [X] T055 Run `quickstart.md` manual verification (7 steps) and record results in the PR description
- [X] T056 Run `npm test` and `npm run compile` — fix any typecheck/test failures surfaced by new modules

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (P1) → Foundational (P2) → User stories
- US7 (prompt standardization) must land before US4/US5 can be validated end-to-end (but its tests via T007 helpers are independent)
- Polish (P10) depends on all stories

### User Story Dependencies

- US1 (status passthrough) and US2 (history-driven badges) both depend only on Foundational
- US3 (schema consistency) depends on Foundational
- US7 depends on Foundational (uses writer helpers from T007)
- US4 depends on US7 (substep events come from prompts) and US1 (ViewerState shape)
- US5 depends on US1 + US2
- US6 depends on US1

### Within Each User Story

- Tests first (marked [P]) — confirm failing
- Pure-logic modules (`stateDerivation`, `footerActions`) before renderers
- Extension-side changes before webview rendering changes

### Parallel Opportunities

- All [P] tasks in Setup (T002, T003) parallel
- Writer helpers (T007) parallel with backfill (T008)
- Tests across US1/US2/US3 (T010, T011, T016, T017, T021, T022, T023) parallel
- All prompt injections T029–T035 parallel
- Docs tasks T052–T054 parallel

---

## Parallel Example: Foundational Tests

```bash
Task: "Unit test stateDerivation status passthrough (T010)"
Task: "Unit test pulse/highlight invariants (T011)"
Task: "Unit test file-existence ignored (T016)"
Task: "Unit test badge state mapping (T017)"
Task: "Integration test schema validation across fixtures (T021)"
```

---

## Implementation Strategy

### MVP (US1 + US2 + US3)

1. Phase 1 Setup
2. Phase 2 Foundational (types, reader/writer, backfill)
3. Phase 3 US1 (single status)
4. Phase 4 US2 (history-driven badges)
5. Phase 5 US3 (uniform shape)
6. **STOP & VALIDATE**: sidebar/header/stepper consistent; template files no longer trigger false progress

### Incremental Delivery

1. MVP above → ship
2. US7 (prompt standardization) → ship
3. US4 (substeps) → ship
4. US5 (pulse/highlight polish) → ship
5. US6 (footer scope) → ship

---

## Notes

- [P] = different files, no ordering dependency on unfinished tasks
- Avoid reintroducing file-existence checks for step state
- Every writer call goes through `specContextWriter` to preserve atomicity and unknown fields
- `transitions` is append-only — never rewrite prior entries
