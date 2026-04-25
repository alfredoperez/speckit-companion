# Quickstart — Verifying Always-Show-Icon

A manual smoke check for reviewers. Each step maps to one of the spec's acceptance scenarios (US1.1–3, US2.1–2). Total time: ~3 minutes.

## Prerequisites

- Build the extension: `npm install && npm run compile && npm run package`.
- Install the resulting `.vsix` into a clean VS Code window (or use F5 to launch the Extension Development Host).
- Close any open folder so VS Code shows the "Start" / "Open Folder" landing page.

## Test 1 — Icon visible at fresh startup *(US1, FR-001, SC-001)*

1. Quit VS Code completely.
2. Relaunch VS Code with no folder argument.
3. Wait for the workbench to finish loading (≤5 seconds).
4. **Expect**: the SpecKit seedling icon is visible in the activity bar, in the same position as when a workspace is open.

## Test 2 — Empty-state welcome shows on click *(US1, FR-002, FR-003)*

1. With no folder open, click the SpecKit icon.
2. **Expect**: the SpecKit sidebar opens, showing a single welcome panel with copy explaining a folder is required, plus an "Open Folder" button.
3. **Expect**: no other SpecKit views (Steering, Settings) appear in the sidebar.

## Test 3 — Open Folder action transitions to normal views *(US1, FR-004, SC-004)*

1. With the empty-state panel visible, click "Open Folder".
2. Pick any local folder (preferably one already initialized for SpecKit so the specs tree has something to show).
3. **Expect**: VS Code reloads the workbench with the selected folder. Within ~1 second of reload, the SpecKit sidebar shows the normal Specs tree (or one of the existing welcome flows if the folder is not yet initialized) — the empty-state panel must not linger.

## Test 4 — Closing the folder restores the empty state *(US2, FR-005)*

1. With a workspace open and the SpecKit views visible, run `File → Close Folder`.
2. **Expect**: the SpecKit icon stays in the activity bar.
3. Click the icon.
4. **Expect**: the empty-state panel from Test 2 reappears, identical in copy and action.

## Test 5 — Existing welcome flows still work *(FR-006)*

1. Open a folder that has the SpecKit CLI installed but no `.specify/` directory yet.
2. **Expect**: the existing "Initialize Workspace" welcome content appears — not the new "Open Folder" empty state.
3. Repeat with a folder that has a stub constitution containing `[PROJECT_NAME]` placeholder.
4. **Expect**: the existing "Configure Constitution" welcome content appears.

## Test 6 — Container visuals unchanged *(FR-007)*

1. Compare the activity-bar entry's icon glyph and tooltip ("SpecKit") to a screenshot from the current marketplace release.
2. **Expect**: identical glyph, identical tooltip, identical position relative to the user's other extension icons.

## Pass criteria

All six tests pass with no manual refresh, no reload prompt (other than the reload that VS Code itself triggers when opening a folder), and no console errors in the Extension Development Host.
