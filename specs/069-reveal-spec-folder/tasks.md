# Tasks: Reveal Spec Folder in OS File Browser

**Input**: Design documents from `/specs/069-reveal-spec-folder/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Test tasks are included — `quickstart.md` ships an explicit automated-test checklist and the project convention (`specCommands.test.ts` already exists) is to cover new command handlers with Jest.

**Organization**: Only one user story exists (P1). Phases 1–2 are empty because this feature plugs into an existing VS Code extension — no new project, no new foundational layer.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps to user stories from spec.md (US1 = Reveal Spec Folder via Context Menu)
- File paths below are absolute to the repository root.

## Path Conventions

Single-project VS Code extension. All source lives under `src/`, webview under `webview/`, and package metadata in `package.json` at the repo root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Nothing to set up — the extension project, Jest config, `tests/__mocks__/vscode.ts`, and `specCommands.ts` / `specCommands.test.ts` files already exist. Skip.

*(No tasks in this phase.)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational changes required. The reveal handler reuses the existing `SpecTreeItem.specPath` field, the existing `viewItem == spec` menu gate, and VS Code's built-in `revealFileInOS` command. Skip.

*(No tasks in this phase.)*

---

## Phase 3: User Story 1 - Reveal Spec Folder via Context Menu (Priority: P1) 🎯 MVP

**Goal**: A developer right-clicks a spec in the Specs tree and picks "Reveal in File Explorer"; the OS file browser opens focused on that spec's folder. Missing folders surface a clear error within ~1s instead of silently failing.

**Independent Test**: Follow `specs/069-reveal-spec-folder/quickstart.md` — happy path (SC-001/SC-002), menu-scoping (FR-004/SC-003), and error path (FR-005/SC-004). Feature ships as a standalone increment.

### Tests for User Story 1 ⚠️

> Write these tests FIRST and confirm they FAIL before implementing T004.

- [X] T001 [P] [US1] Add test "registers speckit.specs.reveal when registerSpecKitCommands runs" in `src/features/specs/specCommands.test.ts` — assert the command id is registered via the existing `vscode.commands.registerCommand` mock.
- [X] T002 [P] [US1] Add test "calls revealFileInOS with absolute folder URI resolved from specPath" in `src/features/specs/specCommands.test.ts` — invoke the registered handler with a `SpecTreeItem { label, specPath }`, stub `vscode.workspace.fs.stat` to resolve, and assert `vscode.commands.executeCommand('revealFileInOS', <Uri>)` was called with the workspace-joined absolute Uri.
- [X] T003 [P] [US1] Add test "falls back to specs/<label> when specPath is undefined" in `src/features/specs/specCommands.test.ts` — invoke with `SpecTreeItem { label: 'foo' }` (no specPath) and assert the Uri passed to `revealFileInOS` ends in `specs/foo`.
- [X] T004 [P] [US1] Add test "shows error and does not call revealFileInOS when folder is missing" in `src/features/specs/specCommands.test.ts` — stub `vscode.workspace.fs.stat` to reject, assert `vscode.window.showErrorMessage` is called with a message containing the absolute path, and assert `executeCommand('revealFileInOS', ...)` is **not** called.
- [X] T005 [P] [US1] Add test "no-op when no workspace folder is open" in `src/features/specs/specCommands.test.ts` — set `vscode.workspace.workspaceFolders = undefined`, invoke handler, assert neither `stat` nor `executeCommand('revealFileInOS', ...)` runs.

### Implementation for User Story 1

- [X] T006 [US1] (Optional) If `src/core/constants.ts` exports a `Commands` enum containing spec-action ids, add `SpecsReveal = 'speckit.specs.reveal'` there so the handler and `package.json` share a single source of truth. If the enum isn't used for these ids, skip and hard-code the string.
- [X] T007 [US1] Register the reveal handler in `src/features/specs/specCommands.ts` inside `registerSpecKitCommands`, next to the existing `speckit.delete` registration (around line 103). Signature: `vscode.commands.registerCommand('speckit.specs.reveal', async (item: SpecTreeItem) => { ... })`.
- [X] T008 [US1] Inside the handler in `src/features/specs/specCommands.ts`: (a) read `vscode.workspace.workspaceFolders?.[0]` and return silently if absent; (b) resolve `relativePath = item.specPath ?? \`specs/${item.label}\`` (same fallback as `speckit.delete` at line 114); (c) build absolute Uri via `vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, relativePath))`.
- [X] T009 [US1] Pre-stat the folder in `src/features/specs/specCommands.ts`: wrap `await vscode.workspace.fs.stat(uri)` in try/catch; on failure call `vscode.window.showErrorMessage(\`Cannot reveal: ${uri.fsPath} does not exist\`)` and return before invoking `revealFileInOS` (satisfies FR-005 and SC-004).
- [X] T010 [US1] On stat success in `src/features/specs/specCommands.ts`: wrap `await vscode.commands.executeCommand('revealFileInOS', uri)` in try/catch and surface `vscode.window.showErrorMessage(err.message)` on failure, matching the defensive style used elsewhere in this file.
- [X] T011 [US1] Add the command contribution in `package.json` under `contributes.commands`: `{ "command": "speckit.specs.reveal", "title": "Reveal in File Explorer", "category": "SpecKit" }`.
- [X] T012 [US1] Add the context-menu entry in `package.json` under `contributes.menus["view/item/context"]`: `{ "command": "speckit.specs.reveal", "when": "view == speckit.views.explorer && viewItem == spec", "group": "navigation@99" }` (or the next available `navigation` order after existing spec-level entries — confirm ordering while editing so the entry sits near the bottom of the group, not above destructive actions like delete).
- [X] T013 [US1] Run `npm run compile` from the repo root and fix any TypeScript errors introduced by T007–T010.
- [X] T014 [US1] Run `npm test -- specCommands` from the repo root and confirm the new tests from T001–T005 pass alongside the existing suite.
- [ ] T015 [US1] Manually validate by launching the Extension Development Host (F5) and walking through all three verification blocks in `specs/069-reveal-spec-folder/quickstart.md` (happy path, menu-scoping, error path). If on macOS only, note that Windows/Linux happy paths are covered by the platform-agnostic `revealFileInOS` delegation — no platform branching to re-test.

**Checkpoint**: User Story 1 is the entire feature. After T015 the spec is shippable.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [X] T016 [P] Update `README.md` to mention the new right-click "Reveal in File Explorer" action under the specs tree section (project rule: update README whenever a user-facing feature changes).
- [ ] T017 [P] If `docs/viewer-states.md` or `docs/architecture.md` document the specs tree context menu, add the new entry there as well; if neither mentions context-menu actions today, skip.
- [ ] T018 Bump the extension patch version in `package.json` (but do NOT commit the bump into the feature PR — per project convention version bumps land separately; install-local will re-bump locally).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: empty — nothing to wait on.
- **Foundational (Phase 2)**: empty — nothing to wait on.
- **User Story 1 (Phase 3)**: the whole feature. Tests (T001–T005) run in parallel and MUST be written (and failing) before T007–T010. T006 is independent and can happen any time. T011/T012 (`package.json`) are independent of the TypeScript edits and can be done in parallel with them, but compile (T013) and test (T014) must come after all code/config changes. T015 is last.
- **Polish (Phase 4)**: T016/T017 depend only on Phase 3 landing; T018 is a mechanical bump.

### User Story Dependencies

- Only one user story (US1). No inter-story dependencies.

### Within User Story 1

- Tests (T001–T005) FIRST → verify they fail → then implementation (T006–T012).
- T007 must precede T008/T009/T010 (they edit the same handler body).
- T011 must precede T012 (the menu entry references the command id contributed in T011).
- T013 (compile) before T014 (test).
- T015 (manual) last.

### Parallel Opportunities

- T001–T005 all edit the same test file but cover independent cases; they can be authored in parallel by different contributors but must merge into one file — treat as "conceptually parallel, physically sequential." Marked [P] for clarity.
- T011 and T012 both edit `package.json` and are sequential with each other, but both can run in parallel with T007–T010 (different file).
- T016 and T017 edit different docs files → truly parallel.

---

## Parallel Example: User Story 1

```bash
# While one contributor writes the Jest cases (same file, coordinate via diff):
Task: "T001 register-command test in src/features/specs/specCommands.test.ts"
Task: "T002 revealFileInOS call test in src/features/specs/specCommands.test.ts"
Task: "T003 specPath-fallback test in src/features/specs/specCommands.test.ts"
Task: "T004 missing-folder error test in src/features/specs/specCommands.test.ts"
Task: "T005 no-workspace no-op test in src/features/specs/specCommands.test.ts"

# Another contributor can simultaneously land the package.json contribution:
Task: "T011 command contribution in package.json"
Task: "T012 view/item/context menu entry in package.json"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 and Phase 2 are empty — nothing to do.
2. Write tests T001–T005, confirm they fail.
3. Land handler edits T007–T010 (+ optional T006).
4. Land `package.json` entries T011–T012.
5. Compile (T013), run tests (T014), manually validate via quickstart (T015).
6. **STOP and VALIDATE**: the feature is complete and shippable.

### Incremental Delivery

Only one increment exists. After User Story 1 passes, run the Polish phase (README / docs / version bump) and open the PR.

### Parallel Team Strategy

This feature is too small to split across a team — realistically one contributor lands everything in under an hour. Parallelism is noted above only to preserve template structure.

---

## Notes

- `[P]` marks tasks that touch different files OR different test cases; respect the same-file caveat in Phase 3.
- No new modules, directories, settings, or schemas. No `.claude/**` or `.specify/**` edits (extension isolation rule).
- Total task count: 18 (5 tests + 10 implementation + 3 polish).
- Suggested MVP scope: T001–T015 (everything in Phase 3).
- Commit after each logical group (tests, handler, package.json, docs). Do not commit the T018 version bump into the feature PR.
