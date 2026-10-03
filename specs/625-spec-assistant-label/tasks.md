# Tasks: Assistant name and Show terminal on a spec

**Spec**: [spec-assistant-label.spec.md](./spec-assistant-label.spec.md) | **Plan**: [plan.md](./plan.md)

Tests are included: the constitution and the review checklist ask for an allow-list test and menu parity tests.

## Phase 1: Foundational

Shared data, the dispatch seam and the state both surfaces read. No story work starts before this is done.

**Wave 1 — independent (different files):**

- [x] **T001** [P] Add `coerceProviderType(value: unknown)`, an allow-list over `AIProviders`, with tests for prototype keys, a non-string and a renamed id · apps/vscode/src/ai-providers/aiProvider.ts, apps/vscode/src/ai-providers/__tests__/coerceProviderType.test.ts
- [x] **T002** [P] Add the optional `assistant` field to `SpecContext` and to the schema · apps/vscode/src/core/types/specContext.ts, apps/vscode/src/core/types/spec-context.schema.json
- [x] **T003** [P] Create the spec terminal registry: remember, look up the newest live terminal, forget on close, notify on change, with tests · apps/vscode/src/features/specs/specTerminals.ts, apps/vscode/src/features/specs/__tests__/specTerminals.test.ts
- [x] **T004** [P] Add `assistantName` and `hasTerminal` to `NavState` and the `showTerminal` viewer message · apps/vscode/src/protocol/viewer.ts

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T005** Create `resolveSpecAssistant` and `recordSpecAssistant` (guarded, one key, never throws), with tests · apps/vscode/src/features/specs/specAssistant.ts, apps/vscode/src/features/specs/__tests__/specAssistant.test.ts

**⟶ Wait for T005, then:**

**Wave 3 — independent (different files):**

- [x] **T006** [P] Note the dispatch after the run resolves: record the assistant and remember a returned terminal; nothing on a suppressed or thrown dispatch; update the test's mocks · apps/vscode/src/features/specs/dispatchStep.ts, apps/vscode/src/features/specs/__tests__/dispatchStep.test.ts
- [x] **T007** [P] Send `assistantName` and `hasTerminal` in every navState for feature spec panels, on first paint and on updates · apps/vscode/src/features/spec-viewer/specViewerProvider.ts, apps/vscode/src/features/spec-viewer/html/generator.ts

## Phase 2: User Story 1 - See which assistant is working on a spec (P1)

Files: apps/vscode/src/features/specs/specExplorerProvider.ts, apps/vscode/webview/src/spec-viewer/components/SpecHeader.tsx, apps/vscode/webview/styles/spec-viewer/_content.css, apps/vscode/webview/src/spec-viewer/components/SpecHeader.stories.tsx

**Goal**: The sidebar row and the viewer header show the same assistant name.

**Independent Test**: Dispatch a step with one provider, read the row and the header.

### Tests

- [x] **T008** [P] [US1] Row description carries the name, keeps it on a duplicate-named spec, and omits it for an unknown id · apps/vscode/src/features/specs/__tests__/specExplorerProvider.test.ts
- [x] **T009** [P] [US1] Header shows the label, and the button only with `hasTerminal` · apps/vscode/webview/src/spec-viewer/components/__tests__/SpecHeader.test.tsx

### Implementation

**Wave 1 — independent (different files):**

- [x] **T010** [P] [US1] Add the resolved name to the row description and tooltip, and append `+terminal` to the row's `contextValue` when the spec has a live terminal · apps/vscode/src/features/specs/specExplorerProvider.ts
- [x] **T011** [P] [US1] Render the assistant label and the Show terminal button in the header badges row, with a story for each state · apps/vscode/webview/src/spec-viewer/components/SpecHeader.tsx, apps/vscode/webview/styles/spec-viewer/_content.css, apps/vscode/webview/src/spec-viewer/components/SpecHeader.stories.tsx

**Checkpoint**: The name shows on both surfaces and survives a reload.

## Phase 3: User Story 2 - Jump to the terminal Companion opened (P2)

Files: apps/vscode/src/features/specs/specCommands.ts, apps/vscode/src/core/constants.ts, package.json, apps/vscode/src/features/specs/selectionContextKeys.ts, apps/vscode/src/features/spec-viewer/messageHandlers.ts, apps/vscode/src/extension.ts

**Goal**: Show Terminal reveals the spec's newest live terminal and disappears when it closes.

**Independent Test**: Dispatch two specs to terminals, use Show Terminal on the first.

### Tests

- [x] **T012** [P] [US2] Row menus list Show Terminal in both the hover submenu and right-click, gated on the suffix, and every spec-row clause tolerates the suffix · apps/vscode/src/features/specs/__tests__/manifest.test.ts
- [x] **T013** [P] [US2] The `showTerminal` message runs the command, and read-only panels drop it · apps/vscode/src/features/spec-viewer/__tests__/messageHandlers.test.ts

### Implementation

**Wave 1 — independent (different files):**

- [x] **T014** [P] [US2] Register `speckit.specs.showTerminal` (row or directory argument), and note the dispatch on the clarify, analyze and checklist path · apps/vscode/src/features/specs/specCommands.ts, apps/vscode/src/core/constants.ts
- [x] **T015** [P] [US2] Contribute the command and its row menu entries, and make every spec-row `when` clause tolerate `+terminal` · package.json
- [x] **T016** [P] [US2] Treat a suffixed `contextValue` as its lifecycle value in the selection keys · apps/vscode/src/features/specs/selectionContextKeys.ts
- [x] **T017** [P] [US2] Add the `showTerminal` adapter · apps/vscode/src/features/spec-viewer/messageHandlers.ts
- [x] **T018** [P] [US2] Register the registry and refresh the sidebar and open viewers when a spec terminal is remembered or closes · apps/vscode/src/extension.ts

**Checkpoint**: The action appears only for a live terminal on both surfaces.

## Phase 4: Polish

- [x] **T019** [P] Document the label, the action and the two limits (no chat-panel jump, no needs-input marker) · README.md, CHANGELOG.md, apps/website/src/content/docs/docs
- [x] **T020** Run `npm run compile`, `npm test` and `npm run package`, and check each Success Criterion

## Dependencies & Execution Order

Foundational → US1 and US2 (disjoint files, either order) → Polish. Foundational: Wave 1 (T001 to T004) blocks T005, which blocks Wave 3 (T006, T007). Each story: tests and implementation in one wave. T020 runs last.
