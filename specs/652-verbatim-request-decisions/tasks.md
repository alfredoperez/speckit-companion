# Tasks: Keep the request verbatim, and say who decided what

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

## Phase 1: Setup

None. The repo, tooling and test runners are already in place.

## Phase 2: Foundational

Files: `apps/speckit-extension/scripts/capture.py`, `apps/speckit-extension/scripts/write-context.py`, `apps/speckit-extension/tests/test_request_and_decisions.py`, `apps/vscode/src/core/types/specContext.ts`, `apps/vscode/src/core/types/spec-context.schema.json`, `apps/vscode/src/features/spec-viewer/stateDerivation.ts`, `apps/vscode/src/features/spec-viewer/__tests__/stateDerivation.test.ts`

**Wave 1 — independent (different files):**

- [x] **T001** [P] [US1] Add `set_request` (write-once, outer trim, blank is a no-op) and `append_decisions` (fills `by` and `at`, reopens by `id` into `earlier`, text de-dup without `id`); route batch `decisions` to `append_decisions` · apps/speckit-extension/scripts/capture.py
- [x] **T002** [P] [US2] Add `request?` to `SpecContext` and `ViewerState`; add `id?`, `by?`, `at?`, `earlier?` to `DecisionEntry` and `by?`, `at?`, `earlier?` to `ViewerDecision`, with an earlier-answer type · apps/vscode/src/core/types/specContext.ts
- [x] **T003** [P] [US2] Declare `request` and the decision `id`, `by`, `at`, `earlier` in the schema · apps/vscode/src/core/types/spec-context.schema.json

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T004** [P] [US1] Add the `--request <path|->` flag (file or stdin, never the `--event` path) and send `--decision` through `append_decisions`; update the `--decision` help text · apps/speckit-extension/scripts/write-context.py
- [x] **T005** [P] [US2] Derive `request` (kept as stored, dropped when blank) and extend `pickDecisions` with `by`, `at`, `earlier`, each guarded so a malformed value is dropped · apps/vscode/src/features/spec-viewer/stateDerivation.ts

**⟶ Wait for Wave 2 to finish, then:**

**Wave 3 — independent (different files):**

- [x] **T006** [P] [US1] Writer tests: request round-trips quotes, `$`, markup and line breaks; second write ignored; blank ignored; decisions stamped; same id same answer adds nothing; reopened twice keeps two earlier answers oldest first; no-id text de-dup unchanged; stdin path through the CLI · apps/speckit-extension/tests/test_request_and_decisions.py
- [x] **T007** [P] [US2] Derivation tests: request passes through; blank request dropped; decision `by`, `at`, `earlier` kept; malformed values dropped; legacy string decision stays `{decision}` · apps/vscode/src/features/spec-viewer/__tests__/stateDerivation.test.ts

## Phase 3: User Story 1 - See the request word for word (P1)

Files: `apps/speckit-extension/nodes/auto/resolve-dir.md`, `apps/speckit-extension/nodes/specify/resolve-dir.md`, `apps/speckit-extension/nodes/specify/resolve-dir-git.md`, `apps/speckit-extension/nodes/plan/gather-context.md`

**Wave 1 — independent (different files):**

- [x] **T008** [P] [US1] After the start stamp, store auto's own input with `--request -` and a quoted heredoc · apps/speckit-extension/nodes/auto/resolve-dir.md
- [x] **T009** [P] [US1] After the start stamp, store specify's input the same way; note a stored request is kept · apps/speckit-extension/nodes/specify/resolve-dir.md
- [x] **T010** [P] [US1] Same line for the git variant · apps/speckit-extension/nodes/specify/resolve-dir-git.md
- [x] **T011** [P] [US1] Read the stored `request` from the record before the codebase investigation, and plan against its words · apps/speckit-extension/nodes/plan/gather-context.md

**Checkpoint**: a run started through auto or specify stores the request once, and plan reads it.

## Phase 4: User Story 2 and 3 - Who answered, and reopening (P1, P2)

Files: `apps/speckit-extension/nodes/specify/quality-checklist-blocking.md`

- [x] **T012** [US2] When the person answers the stop-and-ask table, record each answer as a decision with `"by": "you"` and a stable `id` per question · apps/speckit-extension/nodes/specify/quality-checklist-blocking.md

**Checkpoint**: a person's answer is attributed; the writer handles reopening.

## Phase 5: Overview (US1, US2, US3)

Files: `apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx`, `apps/vscode/webview/styles/spec-viewer/_overview-dossier.css`, `apps/vscode/webview/src/spec-viewer/components/ActivityPanel.stories.tsx`, `apps/vscode/webview/src/spec-viewer/__stories__/viewerHarness.tsx`, `apps/vscode/webview/src/spec-viewer/components/__tests__/OverviewDossier.test.tsx`

**Wave 1 — independent (different files):**

- [x] **T013** [P] [US1] Render the request block under the intent statement (label `Your request, word for word`, text node, pre-wrap); include `request` in the section's visibility check; render `answered by <who> · <when>` with `formatAbsolute` when both are valid, and each earlier answer struck through with `earlier answer · <who> · <when> · reopened`; key rows by `id` when present · apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx
- [x] **T014** [P] [US1] Styles: the request block with a left rule and muted text, wrapping; the decision head row with right-aligned meta; the indented earlier list · apps/vscode/webview/styles/spec-viewer/_overview-dossier.css
- [x] **T015** [P] [US1] Pass `request` through the story harness the way `intent` is · apps/vscode/webview/src/spec-viewer/__stories__/viewerHarness.tsx

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — independent (different files):**

- [x] **T016** [P] [US3] Stories: a request with line breaks and markup, an agent decision, a person's decision, and a decision reopened twice · apps/vscode/webview/src/spec-viewer/components/ActivityPanel.stories.tsx
- [x] **T017** [P] [US2] Component tests: request shown as text with markup escaped; no block without a request; meta shown only with both fields; earlier answers in order; legacy decision unchanged · apps/vscode/webview/src/spec-viewer/components/__tests__/OverviewDossier.test.tsx

**Checkpoint**: the Overview shows the request and each decision's author, time and earlier answers.

## Phase 6: Polish

- [x] **T018** Rebuild the command bodies and check them · `python3 apps/speckit-extension/scripts/build.py` then `--check`
- [x] **T019** Regenerate the canvas styles · `npm run canvas:build`
- [x] **T020** Changelog lines under `[Unreleased]` · CHANGELOG.md, apps/speckit-extension/CHANGELOG.md
- [x] **T021** Validate against the Success Criteria: `npx tsc --noEmit -p ./`, related Jest suites, the speckit-extension Python suite, `instruction-budget.py --strict`, `check-command-emissions.py`, `package-manifest.py --check`

## Dependencies & Execution Order

- Setup → Foundational → Phase 3, Phase 4 and Phase 5 (disjoint files, any order) → Polish.
- Foundational: Wave 1 (writer core, types, schema) blocks Wave 2 (CLI flag, derivation), which blocks Wave 3 (tests).
- Phase 3: one wave of four node edits.
- Phase 4: one task.
- Phase 5: Wave 1 (component, styles, harness) blocks Wave 2 (stories, tests).
- Polish: T018 after Phases 3 and 4; T019 after T014; T021 last.
