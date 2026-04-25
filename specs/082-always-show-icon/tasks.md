---
description: "Task list for Always Show SpecKit Icon in Activity Bar"
---

# Tasks: Always Show SpecKit Icon in Activity Bar

**Input**: Design documents from `/specs/082-always-show-icon/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/manifest.md, quickstart.md

**Tests**: The spec asks for manual quickstart verification; no automated tests are requested. Validation is via the six-test smoke check in `quickstart.md`.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- File paths are absolute or workspace-relative

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the touchpoints for this declarative-only change. No new modules, no dependencies.

- [X] T001 Confirm baseline: open `package.json` and locate `contributes.views.speckit` (around lines 67–86), `contributes.viewsWelcome` (around lines 87–112), and `contributes.viewsContainers.activitybar` (around lines 58–66). No edits in this task — just verify these blocks match the diff in `specs/082-always-show-icon/contracts/manifest.md` so the change in Phase 3 lands cleanly.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: None required. This feature adds no shared code, no new context keys, no new TypeScript types. The data model in `data-model.md` is documentation of existing VS Code context keys only.

**Checkpoint**: Skip directly to Phase 3.

---

## Phase 3: User Story 1 - Confirm extension is installed without opening a project (Priority: P1) 🎯 MVP

**Goal**: Make the SpecKit activity-bar icon visible at startup with no folder open, and show an empty-state welcome with an "Open Folder" action when the user clicks it.

**Independent Test**: Launch a fresh VS Code window with no folder open. The SpecKit icon must appear in the activity bar in its existing position; clicking it must open the sidebar with an "Open a folder to start using SpecKit." message and an `Open Folder` button that triggers the platform folder picker. After picking a folder, the sidebar must replace the empty-state with the normal Specs / welcome content within ~1 second.

### Implementation for User Story 1

- [X] T002 [US1] In `package.json`, remove the `when` clause from the `speckit.views.explorer` view entry under `contributes.views.speckit` (currently `"when": "!(workbenchState == empty || workspaceFolderCount == 0)"` at ~line 72). Leave `id` and `name` intact. Do NOT change `speckit.views.steering` or `speckit.views.settings` — their `when` clauses must remain so they stay hidden without a workspace.

- [X] T003 [US1] In `package.json`, prepend a new entry to the `contributes.viewsWelcome` array (above the existing `speckit.cliInstalled && !speckit.detected` entry around line 88) with:
  - `view`: `"speckit.views.explorer"`
  - `contents`: `"Open a folder to start using SpecKit.\n\n[$(folder-opened) Open Folder](command:vscode.openFolder)"`
  - `when`: `"workbenchState == empty || workspaceFolderCount == 0"`

  Use the exact shape documented in `specs/082-always-show-icon/contracts/manifest.md`. Do not introduce a custom `speckit.openFolder` command — link directly to the built-in `vscode.openFolder`.

- [X] T004 [US1] Validate JSON: run `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` from repo root to confirm `package.json` still parses. Then run `npm run compile` to confirm the TypeScript build is unaffected by the manifest change.

- [X] T005 [US1] Manual verification — execute Tests 1, 2, 3, 5, and 6 in `specs/082-always-show-icon/quickstart.md`:
  - Test 1: icon visible at fresh VS Code startup with no folder.
  - Test 2: clicking the icon shows the new empty-state welcome with the `Open Folder` button, and Steering / Settings views are NOT listed.
  - Test 3: clicking `Open Folder` opens the platform folder picker; after selecting a folder, the sidebar swaps to normal content within ~1 second.
  - Test 5: opening folders that exercise existing welcome states (`speckit.cliInstalled && !speckit.detected`, `speckit.detected && speckit.constitutionNeedsSetup`) still show their existing welcome content — the new empty-state must not appear.
  - Test 6: activity-bar glyph, label ("SpecKit"), and position are unchanged vs. the current marketplace release.

**Checkpoint**: User Story 1 is fully functional. The icon-visibility bug from issue #112 is resolved.

---

## Phase 4: User Story 2 - Smooth handoff back to empty state when the workspace closes (Priority: P2)

**Goal**: When the user runs `File → Close Folder` from an open SpecKit workspace, the activity-bar icon stays put and the sidebar reverts to the same empty-state welcome.

**Independent Test**: Open a workspace with SpecKit visible, then close the folder. The icon must remain in the activity bar and clicking it must show the same empty-state copy as a brand-new install.

**Note on dependencies**: This story is satisfied implicitly by US1's declarative changes — VS Code re-evaluates view `when` clauses and `viewsWelcome` `when` clauses when `workbenchState`/`workspaceFolderCount` flip. No additional manifest or code changes are expected. The tasks below are verification only.

### Implementation for User Story 2

- [X] T006 [US2] Manual verification — execute Test 4 in `specs/082-always-show-icon/quickstart.md`:
  - Open a workspace with SpecKit views visible.
  - Run `File → Close Folder`.
  - Confirm the SpecKit icon stays in the activity bar.
  - Click it; confirm the empty-state welcome from US1 reappears, identical in copy and action.

- [X] T007 [US2] Confirm no extension-side regression in the close-folder path: skim `src/extension.ts` (focus on the activation flow ~lines 35–68 and any workspace-folder change listener) to verify the existing guard `if (!hasWorkspace) return` still prevents manager initialization and that no listener throws when the workspace flips back to empty. No code change unless a regression is observed.

**Checkpoint**: Both user stories work end-to-end with the same set of declarative changes from Phase 3.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and release-readiness around the manifest change.

- [X] T008 [P] Update `README.md` to mention that the SpecKit activity-bar icon is now visible at all times (with no folder open, an empty-state welcome guides the user to open one). Keep the wording brief; place near the existing "Getting Started" / install section so first-time users see it.

- [X] T009 [P] Update `docs/viewer-states.md` IF — and only if — the doc covers activity-bar / sidebar visibility states (it primarily documents the spec-viewer state machine). If the file does not cover the activity-bar container, skip this task without edits.

- [X] T010 Bump the extension version in `package.json` (patch bump from current `0.13.0`) so VS Code picks up the manifest change on local reinstall. This is required by the project's "always bump version locally" rule before running `/install-local` for verification.

- [X] T011 Run the full `quickstart.md` smoke check end-to-end in a freshly packaged extension (`npm run package` → install the resulting `.vsix` into a clean window). All six tests must pass with no console errors and no manual refresh.

- [X] T012 Confirm scope discipline before opening a PR: `git diff` should touch only `package.json`, `README.md` (if updated), and the spec files under `specs/082-always-show-icon/`. No edits under `.claude/**` or `.specify/**`, per the extension-isolation rule in `CLAUDE.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — single confirmation task.
- **Foundational (Phase 2)**: None required for this feature.
- **User Story 1 (Phase 3)**: Depends on Setup. This is the entire fix.
- **User Story 2 (Phase 4)**: Depends on US1 being merged in `package.json` (T002, T003). Itself adds no code; verification only.
- **Polish (Phase 5)**: Depends on US1 + US2 verification passing.

### User Story Dependencies

- **US1 (P1)**: Self-contained — two `package.json` edits + verification.
- **US2 (P2)**: Functionally dependent on US1's manifest edits but requires no further code; once US1 lands, US2 is verifiable.

### Within User Story 1

- T002 and T003 are sequential — both edit `package.json` (same file).
- T004 (build/parse check) depends on T002 + T003.
- T005 (manual quickstart) depends on T004.

### Parallel Opportunities

- Within Polish: T008 and T009 touch different files and can run in parallel.
- T010 (version bump) must happen before T011 (smoke check on packaged build).
- T002 and T003 cannot run in parallel — same file.

---

## Parallel Example: Phase 5 Polish

```bash
# Independent doc updates can run together:
Task: "Update README.md to note the always-visible icon and empty state"
Task: "Update docs/viewer-states.md if it covers container visibility"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 (confirm baseline)
2. T002, T003 (manifest edits — the entire fix)
3. T004 (build/parse check)
4. T005 (manual quickstart Tests 1, 2, 3, 5, 6)
5. **STOP and VALIDATE**: issue #112 is resolved.

### Incremental Delivery

1. Land US1 → marketplace patch release fixes the reported bug.
2. Verify US2 in the same release (no extra code) → close-folder symmetry confirmed.
3. Polish phase ships docs + version bump together with the manifest change.

This is a single-file, single-PR feature in practice. The phasing exists to make each acceptance scenario auditable, not to imply parallel work streams.

---

## Notes

- All edits are declarative `package.json` changes. No new TypeScript files, no new commands, no new context keys.
- The `vscode.openFolder` command is a built-in VS Code API command — do not wrap it.
- The new `viewsWelcome` entry's `when` clause is mutually exclusive with all existing entries because `speckit.detected` is always false without a workspace and no other entry's `when` is satisfiable in the no-workspace state (verified in `research.md` Decision 4).
- Per project convention (extension-isolation rule in `CLAUDE.md`), do not modify `.claude/**` or `.specify/**` to support this feature.
