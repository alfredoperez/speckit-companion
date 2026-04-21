# Quickstart: Reveal Spec Folder in OS File Browser

**Feature**: 069-reveal-spec-folder
**Audience**: Reviewers, QA, and anyone verifying the shipped feature.

## Prerequisites

- VS Code 1.84+ with the SpecKit Companion extension installed from the built
  `.vsix` on this branch.
- A workspace containing at least one spec directory (e.g.
  `specs/069-reveal-spec-folder`).

## Happy-path verification (SC-001, SC-002)

1. Open the SpecKit activity bar panel → **Specs** view.
2. Locate any spec in the tree (e.g. `069-reveal-spec-folder`).
3. Right-click the spec node.
4. In the context menu, click **Reveal in File Explorer**.
5. **Expected**:
   - macOS: Finder opens with the spec's folder selected/focused.
   - Windows: File Explorer opens with the spec's folder focused.
   - Linux: The default file manager opens at the spec's folder.
   - `spec.md`, `plan.md` (if present), `tasks.md` (if present), and
     `.spec-context.json` are visible inside that folder.
6. Total interaction: **2 clicks** (right-click + menu item) → SC-001.

## Menu-scoping verification (FR-004, SC-003)

1. Expand a spec node so its sub-documents (e.g. `spec.md`, `plan.md`) appear.
2. Right-click a sub-document row.
   - **Expected**: the "Reveal in File Explorer" item does **not** appear.
3. Switch to the **Steering** view, right-click any steering document.
   - **Expected**: the action does **not** appear.
4. Right-click a lifecycle group header (Active / Completed / Archived).
   - **Expected**: the action does **not** appear.

## Error-path verification (FR-005, SC-004)

1. In a terminal, rename the spec's directory out from under the extension:
   ```bash
   mv specs/069-reveal-spec-folder specs/069-reveal-spec-folder.bak
   ```
   (Do **not** refresh the tree — the stale tree item is the test fixture.)
2. Right-click the now-stale spec node → **Reveal in File Explorer**.
3. **Expected**: within ~1 second, an error notification appears, e.g.
   `Cannot reveal: /abs/path/to/specs/069-reveal-spec-folder does not exist`.
   No silent failure.
4. Restore the folder:
   ```bash
   mv specs/069-reveal-spec-folder.bak specs/069-reveal-spec-folder
   ```

## Automated test checklist

Expected to exist in `src/features/specs/specCommands.test.ts`:

- [ ] Registers `speckit.specs.reveal` when `registerSpecKitCommands` runs.
- [ ] On invocation with a valid `SpecTreeItem`, calls
      `vscode.commands.executeCommand('revealFileInOS', <Uri>)` with the
      absolute folder URI resolved from `specPath`.
- [ ] Falls back to `specs/<label>` when `specPath` is undefined.
- [ ] On a missing folder (stat rejects), calls
      `vscode.window.showErrorMessage` and does **not** call `revealFileInOS`.
- [ ] Does nothing when no workspace folder is open.

## Smoke-build

```bash
npm install
npm run compile
npm test -- specCommands
```

All three commands must succeed on `main`'s CI environment.
