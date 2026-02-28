# Tasks: Always-Visible Source File Button

## Phase 1 — Core

- [x] **T001** · Keep "Edit Source" visible on completed specs
  - **Do**: In `webview/styles/spec-viewer/_footer.css`, replace the rule `body[data-spec-status="spec-completed"] .actions { display: none; }` with individual hide rules for `.actions-left`, `#regenerate`, and `#approve` while keeping `#editSource` visible
  - **Verify**: Open a completed spec in viewer — "Edit Source" is clickable, Regenerate/Enhance/primary CTA are hidden

- [x] **T002** · Register sidebar "Open Source" command
  - **Do**: In `package.json`, add `speckit.openSpecSource` to `commands` with icon `$(go-to-file)` and title "Open Source File"; add `view/item/context` inline entry with `when: "view == speckit.views.explorer && viewItem =~ /spec-document-/"` and `group: "inline"`
  - **Verify**: Command visible in palette; inline icon appears on spec document tree items

- [x] **T003** · Implement command handler and wire up tree items
  - **Do**: In `specExplorerProvider.ts`, set `resourceUri` on spec-document `SpecItem` using `vscode.Uri.file(fullPath)`. In `extension.ts` (or `specCommands.ts`), register `speckit.openSpecSource` handler that opens the file via `vscode.window.showTextDocument`
  - **Verify**: Click inline icon on any spec/plan/tasks item in sidebar — raw `.md` file opens in editor
