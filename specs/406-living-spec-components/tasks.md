# Tasks: Living Spec Components

**Feature directory**: `specs/406-living-spec-components`
**Size**: oversized — full phased task list.

Render a living spec's repeating structures (draft notice, purpose callout, requirement cards, scenario steps, uncovered evidence) as recognized components inside the existing webview markdown pipeline. Feature specs and unrecognized markdown render unchanged. Each component is a gated string preprocessor with a per-region fallback.

**Line format**: `- [ ] **T###** [P?] [US#] Description · exact/file/path`
`[P]` = independent of others in its wave (different file, no incomplete dependency). `[US#]` maps to a user story.

---

## Phase 1: Setup

Shared scaffolding no component work should duplicate.

**Wave 1 — independent (different files):**

- [x] **T001** [P] Create empty `_living.css` partial with a top comment noting it styles living components via existing viewer tokens · `webview/styles/spec-viewer/_living.css`
- [x] **T002** [P] Add `@import '_living.css';` to the partial index so the new partial ships · `webview/styles/spec-viewer/index.css`

---

## Phase 2: Foundational (blocks every story)

The gate, the module, the fallback wrapper, and the pass-through registration. **No user-story component begins until this phase is done** — every component keys on the gate and the `safe()` wrapper defined here.

**Wave 1 — independent (different files):**

- [x] **T003** [P] Add module-level `livingMode` flag + `export function setLivingMode(value: boolean): void` to the renderer, mirroring `setHasSpecContext`; default `false` · `webview/src/spec-viewer/markdown/renderer.ts`
- [x] **T004** [P] Create the living module scaffold with the `safe(region, fn)` wrapper that catches any throw and returns the input region unchanged (FR-002, FR-003), plus exported preprocessor stubs · `webview/src/spec-viewer/markdown/livingComponents.ts`

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — wiring (depends on the flag + module):**

- [x] **T005** [US1] Run the living preprocessors from `renderer.ts` only when `livingMode` is true, and register the living component root classes in the pass-through recognizer so emitted HTML survives the render loop · `webview/src/spec-viewer/markdown/renderer.ts`
- [x] **T006** [US1] Export `setLivingMode` and the living preprocessors from the markdown barrel · `webview/src/spec-viewer/markdown/index.ts`
- [x] **T007** [US1] Call `setLivingMode(navState.livingMode)` in `index.tsx` on every `contentUpdated` and `viewerStateUpdated`, alongside the existing `setHasSpecContext` call · `webview/src/spec-viewer/index.tsx`

**⟶ Wait for Wave 2 to finish, then:**

**Wave 3 — story scaffold (depends on the module existing):**

- [x] **T008** [US1] Create the stories file with the shared living-mode render harness (a helper that renders a markdown fixture with `setLivingMode(true)`) that later story tasks add cases to · `webview/src/spec-viewer/markdown/LivingComponents.stories.tsx`

---

## Phase 3: User Story 1 — Know it's a draft and why the capability exists (P1) 🎯 MVP

**Goal**: A reader can tell at a glance that a living spec is a draft and why the capability exists, and the safe-fallback contract holds so no later component can blank the page.

**Independent Test**: Open a living spec with a draft marker and a purpose section — the draft notice and purpose callout render at the top. Open one with no purpose — the callout is omitted, not a placeholder. Open an ordinary feature spec — it renders exactly as before, no component treatment.

### Tests

- [x] **T009** [P] [US1] Unit tests: draft notice renders from a top-window `[DRAFT]` marker and leaves the authored banner line intact (FR-006); non-draft renders no notice · `webview/src/spec-viewer/markdown/livingComponents.test.ts`
- [x] **T010** [P] [US1] Unit tests: purpose callout renders only when `## Purpose` exists, verbatim, and is omitted (never placeholder) when absent (FR-007); feature-spec byte parity when `livingMode` is false (FR-001, SC-001) · `webview/src/spec-viewer/markdown/livingComponents.test.ts`
- [x] **T011** [P] [US1] Unit test: a preprocessor that throws returns its region unchanged so the base renderer takes it, dropping no lines (FR-002, FR-003, SC-006, SC-007) · `webview/src/spec-viewer/markdown/livingComponents.test.ts`

### Implementation

**Wave 1 — independent components (different regions, one file — build in either order):**

- [x] **T012** [P] [US1] Implement the draft-notice preprocessor emitting `living-draft-notice`, keyed on the top-window `[DRAFT]` marker, banner line left intact, wrapped in `safe()` (FR-006) · `webview/src/spec-viewer/markdown/livingComponents.ts`
- [x] **T013** [P] [US1] Implement the purpose-callout preprocessor emitting `living-purpose` only when `## Purpose` exists, authored text verbatim, wrapped in `safe()` (FR-007) · `webview/src/spec-viewer/markdown/livingComponents.ts`

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — styles + stories (depend on the emitted classes):**

- [x] **T014** [US1] Style `living-draft-notice` and `living-purpose` via existing viewer tokens; announced trust boundary uses a visually-hidden `.sr-only` target, not `hidden` (FR-021) · `webview/styles/spec-viewer/_living.css`
- [x] **T015** [US1] Story cases: draft, non-draft, missing purpose, very long purpose, fallback path · `webview/src/spec-viewer/markdown/LivingComponents.stories.tsx`

**Checkpoint**: Draft notice + purpose callout render at the top of a living draft, feature specs are byte-identical, and a throwing component falls back to plain markdown. Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 — Scan requirements and their scenarios (P2)

**Goal**: A reader can scan requirements as cards in document order with exact authored wording — confidence only where stated, coverage only where determinable, scenarios with conditions separated from outcomes.

**Independent Test**: Open a living spec mixing observed/inferred requirements, some with coverage and some without — each renders as a card in document order with exact wording, confidence shown only where tagged, coverage shown only where determinable, and scenarios with WHEN separated from THEN/AND.

### Tests

- [x] **T016** [P] [US2] Unit tests: requirement card keyed on the exact `###` heading text with no trim/normalize/re-case (FR-008); inner scenario lines stay individual per-line `.line` units so per-line comments survive (FR-005) · `webview/src/spec-viewer/markdown/livingComponents.test.ts`
- [x] **T017** [P] [US2] Unit tests: confidence badge present only when `[inferred]` tagged, absent (no badge) when untagged (FR-009, FR-010); coverage shown only when determinable, never rendered as `0` (FR-011, FR-019) · `webview/src/spec-viewer/markdown/livingComponents.test.ts`
- [x] **T018** [P] [US2] Unit tests: scenario steps separate WHEN from THEN/AND without reorder/reword (FR-012); a requirement with no scenarios renders cleanly with no empty container (FR-013) · `webview/src/spec-viewer/markdown/livingComponents.test.ts`

### Implementation

**Wave 1 — foundation (the card shell others render inside):**

- [x] **T019** [US2] Implement the requirement-card preprocessor emitting `living-req-card`, opened at the exact un-normalized `###` heading, wrapping still-individual commentable `.line` units, wrapped in `safe()` (FR-004, FR-005, FR-008) · `webview/src/spec-viewer/markdown/livingComponents.ts`

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent sub-components (different regions inside the card):**

- [x] **T020** [P] [US2] Emit `living-req-confidence` (+ `--inferred`) only when stated, and `living-req-coverage` only when determinable (never `0`), attribute-safe for any authored text (FR-009–FR-011, FR-019, FR-020) · `webview/src/spec-viewer/markdown/livingComponents.ts`
- [x] **T021** [P] [US2] Implement the living scenario-steps preprocessor emitting `living-scenario` with `living-when`/`living-then`/`living-and` step classes for the `#### Scenario:` + bold-keyword-bullet format, distinct from `parseAcceptanceScenarios`, wrapped in `safe()` (FR-012, FR-013) · `webview/src/spec-viewer/markdown/livingComponents.ts`

**⟶ Wait for Wave 2 to finish, then:**

**Wave 3 — styles + stories (depend on the emitted classes):**

- [x] **T022** [US2] Style `living-req-card`, `living-req-confidence` (observed vs inferred, inferred reads less trustworthy without a wall of warnings), `living-req-coverage`, and scenario step classes via viewer tokens (FR-010, FR-022) · `webview/styles/spec-viewer/_living.css`
- [x] **T023** [US2] Story cases: observed, inferred, covered, uncovered, unknown-coverage, no-scenarios, many-scenarios, long requirement title · `webview/src/spec-viewer/markdown/LivingComponents.stories.tsx`

**Checkpoint**: Requirements render as ordered cards with correct confidence/coverage gating and separated scenario steps, per-line comments intact. Story 2 is independently functional and testable.

---

## Phase 5: User Story 3 — Understand what the spec did not read (P3)

**Goal**: A reader sees what a surface-first draft did not read — a count and scope statement, files grouped by omission reason in keyboard-operable disclosures closed by default, or a plain "read everything" statement.

**Independent Test**: Open a living spec whose uncovered section lists several files across more than one reason — it opens with a count and scope, groups files by reason, each group closed by default and keyboard-openable. Open a spec that read everything — it says so plainly with no empty banner.

### Tests

- [x] **T024** [P] [US3] Unit tests: uncovered section opens with count + scope before any file list (FR-014); files grouped by reason, not one flat list (FR-015); undeterminable counts omitted, never `0` (FR-019) · `webview/src/spec-viewer/markdown/livingComponents.test.ts`
- [x] **T025** [P] [US3] Unit tests: read-everything sentinel `_None — every file in the area was read._` renders a plain statement, no empty banner (FR-017); unrecognized sub-structure falls back to plain markdown, dropping no line (FR-018, SC-006) · `webview/src/spec-viewer/markdown/livingComponents.test.ts`

### Implementation

**Wave 1 — single preprocessor (one region):**

- [x] **T026** [US3] Implement the uncovered preprocessor: parse `## Uncovered`; sentinel/empty → `living-uncovered-none` plain statement; else emit `living-uncovered` with `living-uncovered-count`/`living-uncovered-scope` then reason-grouped `<details class="living-uncovered-group">` closed by default; defensive fallback for unrecognized lines; wrapped in `safe()` (FR-014–FR-019) · `webview/src/spec-viewer/markdown/livingComponents.ts`

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — styles + stories (depend on the emitted classes):**

- [x] **T027** [US3] Style `living-uncovered`, `living-uncovered-count`/`-scope`, `living-uncovered-group` disclosure (keyboard-operable, closed by default, reduced-motion-safe transition), and `living-uncovered-none` via viewer tokens (FR-016, FR-022) · `webview/styles/spec-viewer/_living.css`
- [x] **T028** [US3] Story cases: nothing uncovered, one file, many files across reasons, and a single reason with a long file list · `webview/src/spec-viewer/markdown/LivingComponents.stories.tsx`

**Checkpoint**: Uncovered evidence renders as count-and-scope + reason-grouped disclosures or a plain read-everything statement. Story 3 is independently functional and testable.

---

## Phase 6: Polish

Cross-cutting validation against the spec's Success Criteria.

**Wave 1 — independent (different concerns):**

- [x] **T029** [P] Audit every emitted node for attribute safety — no authored text into HTML attributes via `escapeHtml`/string concat; DOM-built or attribute-safe escape only (FR-020) · `webview/src/spec-viewer/markdown/livingComponents.ts`
- [x] **T030** [P] Verify all component styles in dark, light, high-contrast, narrow, and reduced-motion, including a still equivalent for the disclosure transition (FR-022) · `webview/styles/spec-viewer/_living.css`
- [x] **T031** [P] Confirm the stories file exercises every enumerated state from the contract's story-coverage list (FR-023, SC-008) · `webview/src/spec-viewer/markdown/LivingComponents.stories.tsx`

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — full-suite validation:**

- [x] **T032** Run the full unit test + build and validate against Success Criteria (SC-001 feature parity, SC-004 no zeros, SC-006 no dropped lines, SC-007 page never blanks) · `webview/src/spec-viewer/markdown/livingComponents.test.ts`

---

## Dependencies & Execution Order

- **Phase 1 (Setup)** → **Phase 2 (Foundational)** → **Phase 3 (US1)** → **Phase 4 (US2)** → **Phase 5 (US3)** → **Phase 6 (Polish)**.
- **Setup**: T001, T002 run together (different files).
- **Foundational**: Wave 1 (T003 flag, T004 module) runs together; Wave 2 wiring (T005–T007) waits on both; Wave 3 story scaffold (T008) waits on the module. This phase blocks all stories.
- **US1**: tests (T009–T011) parallel; impl Wave 1 (T012, T013) parallel; Wave 2 styles+stories (T014, T015) wait on the emitted classes.
- **US2**: card shell (T019) first; then confidence/coverage (T020) and scenarios (T021) in parallel; then styles+stories (T022, T023).
- **US3**: uncovered preprocessor (T026) first; then styles+stories (T027, T028).
- **Polish**: T029–T031 parallel; T032 (full suite) last.
- Each story is an independent increment: US1 ships the shell + fallback, US2 the requirement cards, US3 the uncovered evidence — later stories build on the foundational gate but not on each other.
