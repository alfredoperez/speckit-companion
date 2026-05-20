---
description: "Task list for Per-Document Scratchpad Extras"
---

# Tasks: Per-Document Scratchpad Extras

**Input**: Design documents from `/specs/096-scratchpad-extras/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/webview-messages.md

**Tests**: Included — the plan's Testing section, quickstart "Automated checks", and the suggested phasing all request unit tests (scanner injection, create handler, apply empty guard/prompt). Storybook coverage is included for new/changed webview components per the project's testing conventions.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single VS Code-extension project. Extension code under `src/`, webview UI under
`webview/src/`, webview CSS under `webview/styles/`, tests under `tests/unit/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Naming constants the scanner, handlers, and webview all key off.

- [X] T001 Add scratchpad naming constants (`ScratchpadFiles` map for `spec`/`plan`/`tasks` → `<type>-extra.md`, and `SCRATCHPAD_SUFFIX = '-extra'`) in `src/core/constants.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The model fields, scanner synthesis, NavState passthrough, and sub-tab rendering that EVERY user story depends on. The scratchpad sub-tab cannot appear (and nothing else can be built) until this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Add optional `isScratchpad`, `scratchpadFor: DocumentType`, and `hasContent` fields to `SpecDocument`, and extend the `DocumentType` union with `'spec-extra' | 'plan-extra' | 'tasks-extra'` in `src/features/spec-viewer/types.ts`
- [X] T003 [P] Mirror the same `SpecDocument` field additions and `DocumentType` union extension in `webview/src/spec-viewer/types.ts`
- [X] T004 Synthesize one scratchpad `SpecDocument` per **existing** core source doc (`spec`/`plan`/`tasks` only) in `src/features/spec-viewer/documentScanner.ts` — gate on source existence (skip when source absent), set `type: '<src>-extra'`, distinct `label`, `fileName`/`filePath` in the spec dir, real `exists`, `hasContent` (exists && non-whitespace), `isCore: false`, `category: 'related'`, `parentStep: <src>`, `isScratchpad: true`, `scratchpadFor: <src>`; add the three `*-extra.md` names to the generic related-doc scan skip set so on-disk files are not double-listed (FR-001, FR-004, FR-017; depends on T002)
- [X] T005 Carry the scratchpad fields (`isScratchpad`, `scratchpadFor`, `hasContent`) through `NavState.relatedDocs` to the webview in `src/features/spec-viewer/specViewerProvider.ts` (depends on T002)
- [X] T006 [P] Add `.step-child--scratchpad` distinction styling for the scratchpad sub-tab in `webview/styles/spec-viewer/_navigation.css` (FR-005)
- [X] T007 [P] Apply the `.step-child--scratchpad` class hook keyed off `doc.isScratchpad` when rendering the children rail in `webview/src/spec-viewer/components/NavigationBar.tsx` (FR-005)
- [X] T008 [P] Unit-test scanner synthesis in `tests/unit/spec-viewer/documentScanner.spec.ts`: one scratchpad per existing source, source-absent → no scratchpad, on-disk `*-extra.md` surfaced once (de-dupe), and `hasContent` reflects file emptiness

**Checkpoint**: Scratchpad sub-tabs render (distinct from source tabs) for each existing core doc, with `exists`/`hasContent` flowing to the webview. User stories can now begin.

---

## Phase 3: User Story 2 - Create a scratchpad on demand (Priority: P1)

**Goal**: Opening a scratchpad sub-tab whose file is absent shows an empty state with a single create action that writes the file and switches the view to it; an existing scratchpad opens in the standard editor.

**Independent Test**: Open a scratchpad sub-tab for a doc with no `*-extra.md`, confirm the empty state with a single labeled create action, click it, confirm an empty file is created and the view switches to it; then use Edit and confirm it opens in the standard VS Code editor.

**Note**: Sequenced before US1 because lazy creation (this story) is the natural prerequisite for capturing notes to apply; both are P1.

### Tests for User Story 2

- [X] T009 [P] [US2] Unit-test `handleCreateScratchpad` in `tests/unit/spec-viewer/scratchpadHandlers.spec.ts`: creates an empty file when absent, no-ops when the file already exists, switches the active doc to the new scratchpad, and posts an `actionToast` on write failure

### Implementation for User Story 2

- [X] T010 [US2] Add the `createScratchpad` message (`{ type: 'createScratchpad'; documentType: DocumentType }`) to the viewer→extension union in `webview/src/spec-viewer/types.ts` and the extension-side mirror in `src/features/spec-viewer/types.ts`
- [X] T011 [US2] Implement `handleCreateScratchpad` and route it in `src/features/spec-viewer/messageHandlers.ts`: map the scratchpad doc type → `<src>-extra.md` path in the spec dir, create it empty via `vscode.workspace.fs.writeFile(uri, new Uint8Array())` only if absent, re-scan and switch the active doc to it; on failure log + post `actionToast` (FR-003, FR-007; depends on T010)
- [X] T012 [P] [US2] Create `ScratchpadEmptyState.tsx` (empty-state UI with one create action labeled for the specific file, e.g. "Create spec-extra.md", posting `createScratchpad`) in `webview/src/spec-viewer/components/ScratchpadEmptyState.tsx` (FR-006)
- [X] T013 [P] [US2] Add Storybook coverage for the empty state in `webview/src/spec-viewer/components/ScratchpadEmptyState.stories.tsx`
- [X] T014 [US2] Render `ScratchpadEmptyState` when the active doc is a scratchpad with `!exists` (and the normal markdown view otherwise) in `webview/src/spec-viewer/App.tsx` (FR-006; depends on T012)
- [X] T015 [US2] Add an "Edit" control on the scratchpad view that reuses the existing `editDocument` message/affordance in `webview/src/spec-viewer/components/FooterActions.tsx` (FR-008)

**Checkpoint**: A user can create any of the three scratchpads from its empty state and edit it in the standard editor.

---

## Phase 4: User Story 1 - Capture notes and apply them to a source document (Priority: P1) 🎯 MVP

**Goal**: A scratchpad-gated "Refine" button reads the active scratchpad's full contents and dispatches a direct, in-place AI edit of the matching source document — never a template regeneration — and is hidden on source-document tabs.

**Independent Test**: With an existing non-empty scratchpad (created in US2 or on disk), click Refine and confirm the AI CLI receives a direct-edit instruction targeting the matching `<source>.md` (no slash command, no `setup-*.sh`) and the scratchpad is left intact; switch to the source tab and confirm Refine is hidden.

### Tests for User Story 1

- [X] T016 [P] [US1] Unit-test `handleApplyScratchpad` in `tests/unit/spec-viewer/scratchpadHandlers.spec.ts`: empty/whitespace scratchpad → no dispatch + "Nothing to apply" `actionToast` (FR-012/C3); non-empty → exactly one `executeInTerminal` direct-edit prompt naming the matching `<source>.md`, containing no `/speckit-*` slash command and no `setup-*.sh` (FR-010/FR-011/SC-003/C2); `tasks-extra` maps to `tasks.md` only (mapping)
- [X] T017 [P] [US1] Extend `tests/unit/spec-viewer/footerActions.spec.ts` to assert the Refine button is rendered/active only when the active doc `isScratchpad` and hidden on source-document tabs (FR-009/SC-004/C4)

### Implementation for User Story 1

- [X] T018 [US1] Add the `applyScratchpad` message (`{ type: 'applyScratchpad'; documentType: DocumentType }`) to the viewer→extension union in `webview/src/spec-viewer/types.ts` and the extension-side mirror in `src/features/spec-viewer/types.ts`
- [X] T019 [P] [US1] Implement `handleApplyScratchpad` and route it in `src/features/spec-viewer/messageHandlers.ts`: resolve the active scratchpad + `scratchpadFor` → `<src>.md` under `changeRoot || specDirectory`, read contents, empty guard → `actionToast` and return, else build a direct-edit prompt (reusing the `handleSubmitRefinements` shape: edit in place, do not regenerate from template, do not run setup scripts, do not modify the scratchpad) and dispatch via `deps.executeInTerminal(prompt)` — never a slash command (FR-010, FR-011, FR-012, SC-003; depends on T018)
- [X] T020 [P] [US1] Add the scratchpad-gated Refine button (visible/active only when the active doc `isScratchpad`, posting `applyScratchpad`; not routed through the generic `footerAction` catalog) in `webview/src/spec-viewer/components/FooterActions.tsx` (FR-009; depends on T018)

**Checkpoint**: The full capture-and-apply loop works — create a scratchpad (US2), write notes, Refine to directly edit the matching source. MVP complete.

---

## Phase 5: User Story 3 - See which scratchpads have pending notes at a glance (Priority: P2)

**Goal**: A scratchpad sub-tab that contains content shows a "has notes" indicator; empty or absent ones do not.

**Independent Test**: Add content to one scratchpad, leave another empty/absent, and confirm only the one with content shows the indicator on its sub-tab.

**Note**: Relies on `hasContent` already computed by the scanner (T004); this story only renders it.

### Implementation for User Story 3

- [X] T021 [US3] Render a "has notes" dot on the scratchpad sub-tab when `doc.hasContent` is true in `webview/src/spec-viewer/components/NavigationBar.tsx` (FR-016)
- [X] T022 [P] [US3] Add the has-notes dot CSS (e.g. `.step-child--scratchpad.has-notes::after`) in `webview/styles/spec-viewer/_navigation.css` (FR-016)
- [X] T023 [P] [US3] Add/extend Storybook coverage for the sub-tab has-notes indicator (content vs empty) in `webview/src/spec-viewer/components/NavigationBar.stories.tsx`

**Checkpoint**: Scratchpads with pending notes are distinguishable at a glance.

---

## Phase 6: Inline-Comment System Removal (FR-015 / SC-005) — Cross-Cutting, P1

**Purpose**: Remove the prior inline review-comment infrastructure wholesale so none of its controls remain reachable. Sequenced after the new apply flow exists so the Refine capability is never absent.

- [X] T024 [P] Delete inline-comment components `InlineComment.tsx` and `InlineEditor.tsx` plus their `.stories.tsx` in `webview/src/spec-viewer/components/`
- [X] T025 [P] Delete inline-editor modules `editor/refinements.ts`, `editor/inlineEditor.ts`, `editor/lineActions.ts`, `editor/index.ts`, and legacy `modal.ts` in `webview/src/spec-viewer/`
- [X] T026 [P] Remove the refinement signals (`pendingRefinements`, `activeEditor`, `refineLineNum`, `refineContent`) in `webview/src/spec-viewer/signals.ts`
- [X] T027 Remove the line-action wrapping (`wrapWithLineActions` / `line-add-btn` / `line-comment-slot`) in `webview/src/spec-viewer/markdown/renderer.ts` and the `row-add-btn` injection in `webview/src/spec-viewer/markdown/scenarios.ts`
- [X] T028 Drop line-action setup wiring (and any imports of the deleted editor modules) in `webview/src/spec-viewer/App.tsx` and `webview/src/spec-viewer/index.tsx` (depends on T025, T027)
- [X] T029 [P] Delete CSS partials `_refinements.css`, `_editor.css`, `_modal.css`; remove `.line-add-btn` rules in `_line-actions.css` and `.row-add-btn`/comment-row rules in `_tables.css`; update `@import`s in `index.css` (all under `webview/styles/spec-viewer/`)
- [X] T030 Remove the dead messages `submitRefinements`/`refineLine`/`editLine`/`removeLine` and their handlers in `src/features/spec-viewer/messageHandlers.ts`, drop them from the message unions, and delete the now-unused `Refinement`/`LineType` types in `src/features/spec-viewer/types.ts` and `webview/src/spec-viewer/types.ts`
- [X] T031 Verify `toggleCheckbox` is reachable via direct checkbox clicks in rendered markdown (keep) rather than only via the removed line-action menu; remove it across `webview/src/spec-viewer/` + `src/features/spec-viewer/messageHandlers.ts` only if proven coupled (default: keep)

**Checkpoint**: None of the removed inline-comment controls are reachable; task checkboxes still toggle.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, manual verification, and a clean type-check/test pass.

- [X] T032 [P] Document scratchpad sub-tabs, the empty-state create action, and the scratchpad-gated Refine in the "Reading Specs" subsection of `README.md`
- [X] T033 [P] Update the footer button matrix for the scratchpad-gated Refine (and removal of the old batch refine) in `docs/viewer-states.md`
- [X] T034 [P] Add a CHANGELOG.md entry for per-document scratchpad extras and the inline-comment system removal
- [ ] T035 Run the `quickstart.md` manual verification in the Extension Dev Host: all three user stories, edge cases (empty apply, deleted/created on disk, source absent, mapping), removal acceptance, and non-core guarantees
- [X] T036 Run `npm run compile` and `npm test`; resolve any type or test fallout from the message-union, `SpecDocument`, and removal changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phases 3–5)**: All depend on Foundational. US2 (P1) → US1 (P1) → US3 (P2) in the recommended order; US1 is independently testable against an on-disk scratchpad if run before US2.
- **Removal (Phase 6)**: Independent files mostly; sequenced after US1 so Refine is never absent. Can otherwise proceed in parallel with the user stories.
- **Polish (Phase 7)**: Depends on the desired stories + removal being complete.

### User Story Dependencies

- **US2 (P1)**: Needs Foundational only. No dependency on other stories.
- **US1 (P1)**: Needs Foundational only. Practically pairs with US2 for the full loop, but independently testable via an on-disk `*-extra.md`.
- **US3 (P2)**: Needs Foundational only (reads `hasContent` from T004). No dependency on US1/US2.

### Within Each Story / Phase

- T004 and T005 depend on T002 (model fields).
- T011 depends on T010; T014 depends on T012 (US2).
- T019 and T020 depend on T018 (US1).
- T028 depends on T025 and T027 (removal).
- Tests for a story are written to fail first, then implementation makes them pass.

### Parallel Opportunities

- **Foundational**: T002 ∥ T003 (separate type files); T006 ∥ T007 ∥ T008 after T002.
- **US2**: T012 ∥ T013 ∥ T009 (component, story, test — separate files).
- **US1**: T016 ∥ T017 (tests); then T019 ∥ T020 after T018.
- **US3**: T022 ∥ T023.
- **Removal**: T024 ∥ T025 ∥ T026 ∥ T029 (independent files); T027 then T028; T030/T031 sequential on shared type/handler files.
- **Polish**: T032 ∥ T033 ∥ T034 (docs).

---

## Parallel Example: Foundational (Phase 2)

```bash
# After T001 (constants), launch the independent type + style + test tasks:
Task: "Add SpecDocument scratchpad fields + DocumentType union in src/features/spec-viewer/types.ts"   # T002
Task: "Mirror the same in webview/src/spec-viewer/types.ts"                                             # T003
# After T002:
Task: ".step-child--scratchpad styling in webview/styles/spec-viewer/_navigation.css"                  # T006
Task: "NavigationBar scratchpad class hook in components/NavigationBar.tsx"                             # T007
Task: "Scanner synthesis unit tests in tests/unit/spec-viewer/documentScanner.spec.ts"                 # T008
```

---

## Implementation Strategy

### MVP First (User Stories 2 + 1)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational) — scratchpad sub-tabs render.
2. Complete Phase 3 (US2) — create a scratchpad from its empty state.
3. Complete Phase 4 (US1) — Refine applies notes as a direct source edit.
4. **STOP and VALIDATE**: create → write notes → Refine → confirm direct edit; confirm Refine hidden on source tabs.

### Incremental Delivery

1. Foundational → sub-tabs visible and distinct.
2. US2 → create-on-demand works (demo).
3. US1 → capture-and-apply loop works (MVP demo).
4. US3 → has-notes indicator (P2, may follow initial release).
5. Removal → old inline-comment system gone (SC-005).
6. Polish → docs + quickstart validation + clean compile/test.

### Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps a task to its user story for traceability; Setup/Foundational/Removal/Polish carry no story label.
- Scratchpads are non-core: no `.spec-context.json` writes, no gating, no task counting (FR-013, verified by existing guards — no new code).
- Apply is always a direct edit via `executeInTerminal` — never a `/speckit-*` slash command (SC-003).
- Commit after each task or logical group.
