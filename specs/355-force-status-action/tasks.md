# Tasks: Force-status recovery action in the sidebar

- [x] **T001** Register the `speckit.specs.setStatus` command handler — resolve spec dir from the tree item, show a QuickPick of the eight canonical statuses, show a "Force status to X?" confirm, then call `forceStatus(specDir, chosen, 'user')` and `specExplorer.refresh()`; no-op on cancel at either prompt + src/features/specs/specCommands.ts
- [x] **T002** Contribute the command + menus — add `speckit.specs.setStatus` to `contributes.commands` (title `Set status…`, icon) and add a `view/item/context` entry plus an inline (`group: inline`) entry, both `when`-keyed on `spec-active`/`spec-completed`/`spec-archived` + package.json
- [x] **T003** Add unit test — assert the handler calls `forceStatus` with the chosen status and `'user'`, refreshes once, and writes nothing when the picker or confirm is cancelled + src/features/specs/specCommands.test.ts
- [x] **T004** Verify `npm run compile && npm test` pass + N/A
