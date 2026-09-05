# Tasks: Activation Funnel

**Input**: Design documents from `specs/597-activation-funnel/` (plan.md, research.md, data-model.md, contracts/telemetry-events.md, contracts/ui-contract.md)
**Branch**: `597-activation-funnel` | **Size**: oversized (full phased list)

Verbatim constraints carried throughout: event names `extension.installed` / `spec.created` / `spec.completed` / `workflow.selected`; proof line `specs 60–68% leaner, same correctness`; welcome actions `Create your first spec` / `Open a live sample`; trial affordance `Try Companion for this spec`; funnel order installed → panel opened → spec created → phase dispatched → completed.

## Phase 1: Setup

**Wave 1 — single task:**

- [x] **T001** Extend the VS Code mock with a `createTreeView` fake exposing a drivable `onDidChangeVisibility` event and an initial `visible` flag, so panel-visibility telemetry is testable · tests/__mocks__/vscode.ts

## Phase 2: Foundational (blocks all stories)

**Wave 1 — independent (different files):**

- [x] **T002** [P] Catalogue `GlobalStateKeys.installedEventSent` and add the `speckit.openSampleSpec` entry to the `Commands` constants · src/core/constants.ts
- [x] **T003** [P] Add the funnel event senders (`extension.installed`, `panel.opened`, `sample.opened`), export the shared `workflowTelemetryId` coercer (built-ins verbatim, `default`→`speckit`, else `custom`), extend `spec.created` props (`chosenAs`, `source`), delete `profileTelemetryId` and stop attaching `profile` to `phase.dispatched`, and enforce claim-a-de-dupe-slot-only-after-`sendTelemetryEvent`-returns-true (persistent and in-memory) · src/core/telemetry.ts

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T004** Update the core living spec with the new events, de-dupe scopes (once-ever / per-session / per-transition), and both-switches gating — the behavioral twin of T003, same change · src/core/core.spec.md

## Phase 3: User Story 1 — A first-run that shows the product (P1)

**Goal**: A zero-spec workspace shows one merged welcome; `Open a live sample` seeds the bundled sample into the workspace and opens it in the viewer within a minute.

**Independent Test**: Fresh workspace, zero specs → sidebar renders exactly one welcome block with both pinned actions; clicking the sample action produces a viewable, populated sample spec; clicking again reopens rather than duplicates.

### Tests

**Wave 1 — independent (different files), write to fail first:**

- [x] **T005** [P] [US1] Contract test: `viewsWelcome` renders exactly one block per zero-spec state (mutually-exclusive `when` clauses) and both pinned action strings appear verbatim · src/features/specs/__tests__/manifest.test.ts
- [x] **T006** [P] [US1] Unit test the seed command: no workspace folder → error + zero writes; target absent → copy + open; target present → reopen + zero writes; never overwrites an existing directory · src/features/specs/__tests__/sampleSpec.test.ts

### Implementation

**Wave 2 — independent (different files):**

- [x] **T007** [P] [US1] Author the bundled sample: curated `spec.md`, `plan.md`, `tasks.md`, and a `.spec-context.json` with canonical extension-stamped `history[]` (per-phase timing renders), `status: ready-to-implement`, `sampleSpec: true`, and NO `telemetryInstanceId` · assets/sample-spec/
- [x] **T008** [P] [US1] Ship `assets/sample-spec/**` in the package and exclude `assets/social/**` · .vscodeignore
- [x] **T009** [P] [US1] Merge the two stacked `viewsWelcome` blocks into two mutually-exclusive variants (companion-installed-or-dismissed vs companion-absent-and-not-dismissed, both under `speckit.detected && !speckit.constitutionNeedsSetup`), each with one value line + `Create your first spec` → `command:speckit.create` + `Open a live sample` → `command:speckit.openSampleSpec`; register `speckit.openSampleSpec` in `contributes.commands` · package.json

**⟶ Wait for Wave 2 to finish, then:**

- [x] **T010** [US1] NEW module implementing `speckit.openSampleSpec`: no-workspace explanatory error; seed via `workspace.fs.copy(bundled, specs/<sample-dir>, { overwrite: false })`; open through `speckit.openSpec`; reopen when the target exists; emit `sample.opened` once per session · src/features/specs/sampleSpec.ts

**⟶ Wait for T010 to finish, then:**

- [x] **T011** [P] [US1] Register the sample command with the extension's command registrations · src/features/specs/specCommands.ts
- [x] **T012** [P] [US1] Document the merged welcome (one block, two variants, pinned actions) in the sidebar reference · docs/sidebar.md

**Checkpoint**: US1 is independently functional — a brand-new user can reach the viewer with a populated pipeline without authoring anything (SC-001, SC-002).

## Phase 4: User Story 2 — A Create Spec choice that can sell (P1)

**Goal**: The Create Spec workflow choice renders descriptive radio cards from one shared builder, Companion carries its verbatim proof line, and a one-spec `Try Companion for this spec` trial never touches the configured default.

**Independent Test**: Open Create Spec → every workflow shows a description, Companion's proof line is visible without a click, the trial path submits Companion for this one spec only, and a companion-absent user gets the unchanged install-first flow.

### Tests

**Wave 1 — single task, write to fail first:**

- [x] **T013** [US2] Unit test `buildWorkflowChoices()`: canonical validation/dedupe/reserved-names/provider-filter applied; Companion always present with `installed` from `isCompanionSelectable()`; single-workflow list still collapses the chooser · src/features/workflows/__tests__/workflowManager.test.ts

### Implementation

**Wave 2 — independent (different files):**

- [x] **T014** [P] [US2] Add `buildWorkflowChoices(root, provider)` — the ONLY producer of pick-surface workflow lists — with `isCompanionSelectable()` as the single shared predicate (FR-007) · src/features/workflows/workflowManager.ts
- [x] **T015** [P] [US2] Extend `WorkflowDefinition` with `description` (Companion's = the pinned proof line), `installed`, and the `chosenAs: 'default' | 'picked' | 'trial'` submission field · src/features/spec-editor/types.ts
- [x] **T016** [P] [US2] Mirror the workflow-entry shape (`name`, `displayName`, `description`, `installed`, `supportsAuto?`, `specifyCommands?`) and the submit-family `{ workflow, chosenAs }` additions per the UI contract · webview/src/spec-editor/types.ts
- [x] **T017** [P] [US2] Choice-card styles for the radio-card group and install-to-enable state (split into a partial only if the 200-line threshold is crossed) · webview/styles/spec-editor.css

**⟶ Wait for Wave 2 to finish, then:**

- [x] **T018** [P] [US2] Remove the dead `selectWorkflow` quick-pick and `needsSelection`; keep the `resolveDefaultWorkflow` path; coercion now lives only in the shared `workflowTelemetryId` (FR-008) · src/features/workflows/workflowSelector.ts
- [x] **T019** [P] [US2] Consume the shared builder (delete the private `getWorkflows()`); attribute `spec.created` to the effective post-install-modal selection with `chosenAs`, coerced via `workflowTelemetryId` (the `command.includes('companion.')` sniff removed); plumb the trial submission; leave the install-first prompt / stock fallback / cancel flow byte-for-byte intact (FR-010); NO path reads or writes `speckit.defaultWorkflow` · src/features/spec-editor/specEditorProvider.ts
- [x] **T020** [P] [US2] Render `initWorkflows` as descriptive radio cards (descriptions visible, never tooltip-only; `installed: false` → install-to-enable state); show `Try Companion for this spec` on the Companion card when the pre-selected default is not Companion; submit-family messages carry `{ workflow, chosenAs }`; `submitAuto` stops silently discarding the workflow; `workflows.length <= 1` keeps hiding the chooser · webview/src/spec-editor/index.ts

**⟶ Wait for Wave 3 to finish, then:**

- [x] **T021** [P] [US2] Update the workflows barrel exports for the builder addition and selector removals · src/features/workflows/index.ts
- [x] **T022** [P] [US2] Mock parity: choice cards, Companion installed / not-installed states, trial affordance — through the shipped `spec-editor.css` class names · webview/src/spec-editor/CreateSpecMock.tsx
- [x] **T023** [P] [US2] New stories: multi-workflow choice, Companion-not-installed, trial state · webview/src/spec-editor/__stories__/CreateSpec.stories.tsx
- [x] **T024** [P] [US2] Living spec: the one-predicate requirement is now satisfied by `buildWorkflowChoices` · src/features/spec-editor/spec-editor.spec.md
- [x] **T025** [P] [US2] Living spec: the descriptive choice-control requirement and Storybook parity obligation · webview/src/spec-editor/editor-ui.spec.md
- [x] **T026** [P] [US2] Fix the stale claim that Create Spec shows no picker when Companion isn't installed (false since install-to-enable) · docs/configuration.md

**Checkpoint**: US2 is independently functional — the choice control sells, the trial works, the companion-absent path is unchanged (SC-003, part of SC-008).

## Phase 5: User Story 3 — A funnel that measures every rung (P1)

**Goal**: `extension.installed` fires once ever, `panel.opened` once per session, `spec.created` is honestly attributed (form and watcher sources) with a persisted per-spec id, and `spec.completed` fires from one watcher seam covering all three completion paths exactly once.

**Independent Test**: One scripted session covering first activation, panel open, spec creation, and completion via each of the three paths produces exactly the expected events, and the disclosure docs list every one.

### Tests

**Wave 1 — independent (different files), write to fail first:**

- [x] **T027** [P] [US3] Test `extension.installed` (fires when the marker is unset; marker persisted ONLY after a confirmed send; never re-fires) and `panel.opened` (initial-visible check plus visibility event; repeated toggles never re-fire; unsent events burn no slot) using the T001 tree-view fake · src/core/__tests__/funnelEvents.test.ts
- [x] **T028** [P] [US3] Test the completion seam: `TransitionCache` status diff fires `spec.completed` exactly once per transition into `completed` across all three paths; first-sight seeding of an already-completed spec never fires; a `completed` re-write never re-fires; watcher `spec.created` emits only for id-less, non-`sampleSpec` contexts · src/features/specs/__tests__/completionSeam.test.ts

### Implementation

**Wave 2 — independent (different files):**

- [x] **T029** [P] [US3] In `activate()`: send `extension.installed` when `globalState[installedEventSent]` is unset, persisting the marker only on confirmed send; subscribe `specsTreeView.onDidChangeVisibility` plus an initial `visible` check for the per-session `panel.opened` · src/extension.ts
- [x] **T030** [P] [US3] Seed the form-minted `telemetryInstanceId` into the new spec's record via the creation preamble, so created → dispatched → completed join on one id and the watcher can discriminate form-created specs (FR-016) · src/ai-providers/promptPreamble.ts
- [x] **T031** [P] [US3] Extend `TransitionCache` to cache `status` and detect old ≠ `completed` → new = `completed`; seed silently on first sight (initial scan and `onDidCreate`); evict on `onDidDelete` · src/features/specs/transitionLogger.ts

**⟶ Wait for Wave 2 to finish, then:**

- [x] **T032** [US3] Wire `handleSpecContextChange` to the single `spec.completed` emit at the status transition (the one owner, all three paths), and emit watcher `spec.created` (`source: 'watcher'`) on `onDidCreate` of a context with no `telemetryInstanceId` and no `sampleSpec` marker, then mint + back-fill the id · src/core/fileWatchers.ts

**⟶ Wait for T032 to finish, then:**

- [x] **T033** [P] [US3] Remove the direct `spec.completed` emit from the sidebar command path — the watcher seam is now the only emitter · src/features/specs/specCommands.ts
- [x] **T034** [P] [US3] Living spec: the completion-observation seam (observes forward-only status, adds no `completed` writer) · src/features/specs/specs.spec.md
- [x] **T035** [P] [US3] Disclosure rows (FR-015): `extension.installed`, `panel.opened`, `sample.opened`, the new `spec.created` properties (`workflow`, `chosenAs`, `source`), `spec.completed` all-paths semantics, the `profile` removal, and the `workflow.selected` retirement note · docs/telemetry.md

**Checkpoint**: US3 is independently functional — all five rungs observable from one scripted session, disclosure complete (SC-004, SC-005).

## Phase 6: User Story 4 — A dashboard that shows the funnel (P2)

**Goal**: PostHog shows the five-stage funnel in pinned order with no dead tiles; the repo records the funnel-reading recipe and the specify-vs-plan parity result.

**Independent Test**: Open the dashboard → five-stage funnel view exists, the profile/turbo tile is gone, and the parity result is recorded in the docs on fresh post-fix data.

### Implementation

**Wave 1 — independent (doc file vs external tool):**

- [x] **T036** [P] [US4] Add the five-stage funnel recipe (installed → panel opened → spec created → phase dispatched → completed) to the "Reading these in PostHog" section · docs/telemetry.md
- [x] **T037** [P] [US4] In the PostHog dashboard: build the five-stage funnel view and delete the retired profile/turbo tile (FR-017, FR-018) · PostHog dashboard (external, no repo file)

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T038** [US4] Run the specify-vs-plan parity check against fresh post-fix PostHog data and record the result beside the funnel recipe (FR-019) · docs/telemetry.md

**Checkpoint**: US4 is independently verifiable — funnel view live, zero dead tiles, parity recorded (SC-006).

## Phase 7: User Story 5 — Launch content led by customization and visualization (P2)

**Goal**: The run-in-flight clip, the make-it-yours asset, the benefit-led listing with the stat above the fold, and the Copilot carousel all exist, produced through the established visual-asset pipeline.

**Independent Test**: Each asset exists and leads with customization or visualization; the clip runs 30–60s showing a run in flight; the README's three clip placeholders are resolved.

### Implementation

**Wave 1 — independent (different files/dirs):**

- [x] **T039** [P] [US5] New HyperFrames composition from `step-rail`'s tracked running-state captures plus `overview`'s per-phase-timing beat: 30–60s, live rail + per-phase timing together; render via the established recipe (mp4 → palettegen/gifsicle, 960 px / 14 fps, representative frame zero, seamless loop) and promote to docs/screenshots/generated/run-in-flight.gif · media/feature-clips/run-in-flight/
- [x] **T040** [P] [US5] New customization composition — swap workflow → shape commands → pick provider — rendered through the same pipeline (FR-021) · media/feature-clips/make-it-yours/
- [x] **T041** [P] [US5] Render the three existing compositions (`spec-viewer`, `inline-comments`, `specs-sidebar`) and promote their GIFs additively — referenced PNG stills stay in place untouched (published-listing 404 rule) · docs/screenshots/generated/
- [x] **T042** [P] [US5] Carousel for Copilot users (US + India): slide PNGs composed only from real captured UI plus a regeneration prompt sheet derived from HERO-PROMPT.md art direction (dark `#0F0F13`, blueprint grid, blue glow, one yellow accent, no purple); never packaged · assets/social/carousel-copilot/
- [x] **T043** [P] [US5] Benefit-led `description` carrying the leaner-specs stat; `keywords` gain `copilot`, `gemini`, `codex`, `cursor`; `galleryBanner.color` → `#0F0F13` · package.json

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T044** [US5] Put the leaner-specs stat in the opening bold value paragraph above the fold (citing docs/configuration.md#workflow-choice as source of truth) and resolve the three clip-promotion placeholders with the promoted GIFs (or remove) · README.md

**Checkpoint**: US5 is independently verifiable — every asset exists and leads with the two loved capabilities (SC-007).

## Phase 8: Polish

**Wave 1 — independent (different files):**

- [x] **T045** [P] Root changelog entry under `## [Unreleased]` for the merged welcome, live sample, descriptive workflow choice + trial, and telemetry additions — user-facing release-notes voice, no internal symbols · CHANGELOG.md
- [x] **T046** [P] Fix living-spec drift: run the drift report (`/speckit-companion-living-drift`) across the loaded capabilities (core, specs, workflows, spec-editor, editor-ui, spec-viewer) and fold every pre-existing drifted source change into its living spec, so this PR leaves all capabilities drift-clean for the next run · src/**/\*.spec.md + webview/src/**/\*.spec.md

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T047** Validate against Success Criteria: full Jest suite + lint/build green; scripted end-to-end funnel session shows all five rungs (SC-005); existing create/dispatch/complete/install-prompt tests pass unchanged (SC-008 / FR-024); demo fixtures restored to baseline if the run mutated them · tests + build (whole repo)

## Dependencies & Execution Order

**Phase order**: Setup (T001) → Foundational (T002–T004) → US1 (T005–T012) → US2 (T013–T026) → US3 (T027–T035) → US4 (T036–T038) → US5 (T039–T044) → Polish (T045–T047). US1/US2/US3 all sit on the Foundational phase; US4 needs US3's events; US5 markets US1/US2's surfaces; Polish is last.

- **Setup**: T001 single — unblocks US3's tests.
- **Foundational**: Wave 1 (T002 ∥ T003) → T004. T002+T003 block every story phase.
- **US1**: tests (T005 ∥ T006) → Wave 2 (T007 ∥ T008 ∥ T009) → T010 (needs the asset and command id) → Wave 4 (T011 ∥ T012).
- **US2**: T013 → Wave 2 (T014 ∥ T015 ∥ T016 ∥ T017) → Wave 3 (T018 ∥ T019 ∥ T020) → Wave 4 (T021 ∥ T022 ∥ T023 ∥ T024 ∥ T025 ∥ T026). T021 waits on both T014 and T018; T022/T023 need T017's class names and T020's card markup.
- **US3**: tests (T027 ∥ T028) → Wave 2 (T029 ∥ T030 ∥ T031) → T032 (needs T031's cache API) → Wave 4 (T033 ∥ T034 ∥ T035). T033 must land only after T032 so completion coverage never gaps.
- **US4**: Wave 1 (T036 ∥ T037) → T038 (writes the same doc file as T036).
- **US5**: Wave 1 (T039 ∥ T040 ∥ T041 ∥ T042 ∥ T043) → T044 (README links the promoted GIFs).
- **Polish**: Wave 1 (T045 ∥ T046 — drift fix runs after every implementation phase so it syncs against final source) → T047 (validation runs last, over everything).

Cross-phase same-file notes: package.json (T009 then T043), specCommands.ts (T011 then T033), docs/telemetry.md (T035 then T036 then T038) — always in different phases, never in one wave.
