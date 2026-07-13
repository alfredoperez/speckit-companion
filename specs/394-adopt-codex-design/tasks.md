# Tasks: Adopt the Codex Redesign in the Spec Viewer

**Input**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) · [data-model.md](./data-model.md) · [contracts/ui-contract.md](./contracts/ui-contract.md)
**Design reference**: `webview/src/spec-viewer/__redesign__/codex/` (stories + codex.css) — the pixel authority until reconciliation (T029)

## Phase 1: Setup

*(none — tooling, build, and test setup are unchanged; the design reference is already in the repo)*

## Phase 2: Foundational (blocks all stories)

**Wave 1 — single task:**

- [ ] **T001** Re-value the token layer to the Codex palette: dark defaults + `body.vscode-light` block from `codex.css` roles mapped onto the existing token names (`--bg-*`, `--text-*`, `--accent*`, status, `--code-*`), new role tokens only where no equivalent exists (`--surface-3`, `--accent-soft`, `--cx-code` equivalent), radius tokens 2px→6px, host-font leads (Geist demoted), high-contrast block kept coherent; update the tokens.css header comment that documents the old 2px direction · `webview/styles/tokens.css`

**Checkpoint**: every partial now renders on the Codex palette in both themes; nothing else changes yet.

## Phase 3: User Story 1 — Read any spec without losing content (P1)

### Implementation

**Wave 1 — independent (different files):**

- [ ] **T002** [P] [US1] Code on the owned always-dark surface in both themes + language-chip chrome; keep hljs github-dark · `webview/styles/spec-viewer/_code.css`
- [ ] **T003** [P] [US1] Tables: real table layout, header treatment, row hover, tabular numerals · `webview/styles/spec-viewer/_tables.css`
- [ ] **T004** [P] [US1] Requirements as compact scan rows (`.req-row`/`.req-badge`/`.req-text`, `data-kind` variants) · `webview/styles/spec-viewer/_requirements.css`
- [ ] **T005** [P] [US1] Callouts: Codex treatment for all types incl. GitHub alerts · `webview/styles/spec-viewer/_callouts.css`
- [ ] **T006** [P] [US1] Task phases + task lines: compact `.phase-header`, task rows, `.task-item__*`, `.task-details` · `webview/styles/spec-viewer/_task-phases.css`, `webview/styles/spec-viewer/_tasks.css`
- [ ] **T007** [P] [US1] Artifact structures: entities, decision cards, tech grid, constitution rows, checklist groups with semantic completion color · `webview/styles/spec-viewer/_artifacts.css`
- [ ] **T008** [P] [US1] Reading column: bounded story sections, heading scale, prose/identifier hierarchy, hide empty `.spec-meta`, remove `details.template-instructions` from the reading view, `.meta-branch` guaranteed contrast · `webview/styles/spec-viewer/_content.css`
- [ ] **T009** [P] [US1] Heading TOC restyled inside the reading column (kept behavior, Codex look) · `webview/styles/spec-viewer/_toc.css`

**⟶ Wait for Wave 1 to finish, then:**

- [ ] **T010** [US1] Content-fidelity pass: open `_00…_03` demo fixtures + specs 392/172 on every document type in BOTH themes; fix any unstyled/broken/unreadable content type found (FR-010/FR-002/FR-011 acceptance) · touched partials as found

**Checkpoint**: every markdown content type renders styled and readable in both themes — US1 independently verifiable via the Markdown Rendering stories and demo fixtures.

## Phase 4: User Story 2 — The viewer still reacts to the run lifecycle (P1)

### Implementation

**Wave 1 — independent (different files):**

- [ ] **T011** [P] [US2] Status badge system onto Codex badge roles (all canonical statuses; keep working/review pulse behaviors, reduced-motion safe) · `webview/styles/spec-viewer/_animations.css` + badge rules in `webview/styles/spec-viewer/_content.css`
- [ ] **T012** [P] [US2] Footer buttons onto Codex button roles (primary/secondary/ghost/danger; ids, visibility rules, and messages unchanged) · footer button rules in `webview/styles/spec-viewer/_content.css` (or `_base.css` where they live)

**⟶ Wait for Wave 1 to finish, then:**

- [ ] **T013** [US2] State-matrix verification: walk every canonical status per `docs/viewer-states.md` (fixtures + `ViewerTransitions.stories.tsx`), confirm badge/step-marks/actions per state, fix regressions, and update the Transitions stories to the new visuals · `webview/src/spec-viewer/components/__stories__/ViewerTransitions.stories.tsx`

**Checkpoint**: every lifecycle state renders its documented affordances on the restyled components — US2 verifiable on the current shell before any recomposition.

## Phase 5: User Story 3 — The run's story is the front page (P2)

### Implementation

**Wave 1 — independent (different files):**

- [ ] **T014** [US3] View state: `overview | document` replaces the Activity boolean; default `overview` when `hasAnyData(viewerState)`, `document` otherwise; living mode forces `document`; App renders shell regions from it · `webview/src/spec-viewer/signals.ts`, `webview/src/spec-viewer/App.tsx`
- [ ] **T015** [P] [US3] Shell grid: rail | capped main | aside areas, 980px aside-yield, 700px rail-strip breakpoints, no horizontal page scroll · `webview/styles/spec-viewer/_base.css`

**⟶ Wait for Wave 1 to finish, then (independent, different files):**

- [ ] **T016** [P] [US3] Shell top from `SpecHeader`: title, subtitle (branch/workflow), status badge, Overview/Documents view switch; story updated · `webview/src/spec-viewer/components/SpecHeader.tsx` (+ its stories)
- [ ] **T017** [P] [US3] Document rail from `NavigationBar` + `StepTab`: Pipeline/Artifacts groups, rail marks (completion) independent from `aria-current` (selection), living-mode tier tabs preserved; stories updated · `webview/src/spec-viewer/components/NavigationBar.tsx`, `webview/src/spec-viewer/components/StepTab.tsx`, `webview/styles/spec-viewer/_navigation.css` (+ stories)
- [ ] **T018** [P] [US3] Shell footer from `FooterActions`: context line, "Other actions" menu backed by `enhancementButtons`, primary CTA via `getApproveLabel()`, in-flight = no CTA; story updated · `webview/src/spec-viewer/components/FooterActions.tsx` (+ its stories)
- [ ] **T019** [P] [US3] `RunAside` (new): run facts (status/phase/task/progress/checks/concerns) rendered only when present; new story · `webview/src/spec-viewer/components/RunAside.tsx` (+ new stories file)
- [ ] **T020** [P] [US3] Overview presentation in `ActivityPanel`: progress hero, metrics row, latest-activity feed from history, ICE + decisions + evaluation + coverage, approach behind progressive disclosure; cards + error boundary kept; stories updated · `webview/src/spec-viewer/components/ActivityPanel.tsx`, `webview/styles/spec-viewer/_activity.css` (+ stories)

**⟶ Wait for Wave 2 to finish, then:**

- [ ] **T021** [US3] Shell integration: App wires all regions; Overview default verified for active/completed specs, document fallback for no-activity specs, living-mode exemption; `FullViewer.stories.tsx` updated to the new shell · `webview/src/spec-viewer/App.tsx`, `webview/src/spec-viewer/FullViewer.stories.tsx`

**Checkpoint**: opening a spec lands on the Overview with real captured data; documents one click away on the rail — US3 demoable in the Full Viewer stories and Extension Development Host.

## Phase 6: User Story 4 — Custom workflows drive the shell (P2)

### Implementation

**Wave 1 — single task:**

- [ ] **T022** [US4] Workflow map in the rail: arbitrary ordered steps from the workflow definition, custom labels, `doc` vs `action` step kinds (actions marked, non-openable), created/current/pending marks · `webview/src/spec-viewer/components/NavigationBar.tsx`, `webview/styles/spec-viewer/_navigation.css`

**⟶ Wait, then (independent):**

- [ ] **T023** [P] [US4] Step-owned sub-files and free-named documents group under their owning step in the rail (existing `parentStep`/related-docs derivation, new presentation) · `webview/src/spec-viewer/components/NavigationBar.tsx` (rail grouping) 
- [ ] **T024** [P] [US4] Custom-workflow verification: run the committed custom-workflow examples (`examples/`), confirm steps/labels/progression/CTA label/Other-actions dispatch unchanged; add a custom-workflow story variant to NavigationBar stories · `webview/src/spec-viewer/components/NavigationBar.stories.tsx`

**Checkpoint**: a non-stock workflow renders its own steps and actions end-to-end — US4 verifiable on the examples.

## Phase 7: User Story 5 — The reading layout holds at any width (P3)

### Implementation

**Wave 1 — independent (different files):**

- [ ] **T025** [P] [US5] Responsive sweep 700–1600px: prose cap holds, aside yields ~980, rail becomes horizontal strip ~700, zero horizontal page scroll; fix what the sweep finds · `webview/styles/spec-viewer/_base.css`, `webview/styles/spec-viewer/_navigation.css`
- [ ] **T026** [P] [US5] Comments + refinement queue: line-anchored threads, composer, and persisted comments restyled; pending feedback surfaces as the refinement queue with count; InlineComment/InlineEditor stories updated · `webview/styles/spec-viewer/_line-actions.css`, `webview/styles/spec-viewer/_refinements.css` (+ comment stories)

**Checkpoint**: layout honest at every width with comments anchored — US5 verifiable by resizing the Dev Host / Layout stories.

## Phase 8: Polish

**Wave 1 — independent (different files):**

- [ ] **T027** [P] Retire the bundled Geist injection once no token resolves to it (webview font = host font) · `src/features/spec-viewer/html/generator.ts`
- [ ] **T028** [P] Docs with the change: `docs/viewer-states.md` visual descriptions (transitions untouched), `docs/DESIGN.md` geometry direction (2px→Codex 6px), README viewer sections + screenshot retake list · `docs/viewer-states.md`, `docs/DESIGN.md`, `README.md`

**⟶ Wait for Wave 1 to finish, then:**

- [ ] **T029** Story reconciliation: updated real-component stories are the canonical visual baseline; retire the duplicated `__redesign__/codex` stories (keep `RATIONALE.md` + `codex.css` reference or fold into docs), Storybook build green · `webview/src/spec-viewer/__redesign__/codex/`
- [ ] **T030** Final validation against Success Criteria: `npm test` green, `npm run compile` green, `build-storybook` green, AA audit both themes (SC-003), state matrix pass (SC-001), content-type pass (SC-002), custom workflow pass (SC-004), width sweep (SC-006); record results · validation across the above

**Checkpoint**: all six Success Criteria measured and passing.

## Dependencies & Execution Order

- **Phase 2 → everything**: T001 (tokens) blocks all styling work.
- **Phase 3 (US1)**: Wave 1 = T002–T009 all `[P]` (different partials) → T010 fidelity pass joins.
- **Phase 4 (US2)**: Wave 1 = T011–T012 `[P]` → T013 matrix verification joins. Independent of Phase 3 except shared tokens (can start after T001; verification T013 is best after T010).
- **Phase 5 (US3)**: Wave 1 = T014 + T015 `[P]` → Wave 2 = T016–T020 all `[P]` (different components) → T021 integration joins. Requires Phase 4's restyled badges/buttons for a coherent result.
- **Phase 6 (US4)**: T022 → T023, T024 `[P]`. Requires the Phase 5 rail.
- **Phase 7 (US5)**: T025, T026 `[P]`. Requires the Phase 5 shell grid.
- **Phase 8**: T027, T028 `[P]` anytime after Phase 5; T029 → T030 last.
