# Tasks: Reveal File In Explorer

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-25

## Format

- `[P]` marks tasks that can run in parallel with adjacent `[P]` tasks.
- Consecutive `[P]` tasks form a **parallel group** — `/sdd:implement` spawns them as concurrent subagents.
- Tasks without `[P]` are **gates**: they start only after all prior tasks complete.
- Two tasks that touch the same file are never both `[P]`.

---

## Phase 1: Core Implementation

- [x] **T001** Make `filePath` public on `SpecTreeItem` — `src/features/specs/specExplorerProvider.ts` | R003
  - **Do**: In the `SpecTreeItem` constructor (~line 584), change `private readonly filePath?: string,` → `public readonly filePath?: string,`. No other code changes.
  - **Verify**: `npm run compile` passes. The existing `fileUri` property derived from `filePath` (line 649–654) is unaffected.

- [x] **T002** Extend reveal handler to handle file items *(depends on T001)* — `src/features/specs/specCommands.ts` | R001, R002, R003, R005
  - **Do**: In the `speckit.specs.reveal` command handler, change the relativePath resolution from:
    ```ts
    const relativePath = (item as SpecTreeItem).specPath || `specs/${item.label}`;
    ```
    to:
    ```ts
    const relativePath = item.filePath || item.specPath || `specs/${item.label}`;
    ```
    Keep the rest of the handler (existence check + error toast + `revealFileInOS` call) unchanged.
  - **Verify**: `npm run compile` passes; `npm test -- specCommands` passes (existing 069 tests must still pass).

- [x] **T003** Wire reveal to file-item context menus — `package.json` | R001, R002
  - **Do**: In `contributes.menus["view/item/context"]`, after the existing `speckit.specs.reveal` entry for `viewItem == spec` (~line 493–497), add two new entries:
    ```json
    {
      "command": "speckit.specs.reveal",
      "when": "view == speckit.views.explorer && viewItem =~ /^spec-document/",
      "group": "navigation@99"
    },
    {
      "command": "speckit.specs.reveal",
      "when": "view == speckit.views.explorer && viewItem == spec-related-doc",
      "group": "navigation@99"
    }
    ```
  - **Verify**: `npm run compile` passes (package.json has no type checking but webpack runs). Manually: reload the extension, right-click `spec.md` under any spec → "Reveal in File Explorer" appears → clicking it opens Finder with the file selected.

- [x] **T004** Add tests for the file-level reveal paths *(depends on T002)* — `src/features/specs/specCommands.test.ts` | R001, R003, R005
  - **Do**: In the existing `describe('speckit.specs.reveal command handler', ...)` block (~line 227), add three new `it` cases following the existing structural pattern (which already mocks `executeCommand` and constructs a `SpecTreeItem`):
    - "calls revealFileInOS with file URI when item has filePath" — pass a tree item with `filePath: 'specs/080-foo/spec.md'` and verify the executed `revealFileInOS` URI ends with `/specs/080-foo/spec.md`.
    - "falls back to specPath when filePath is undefined" — pass `specPath: 'specs/080-foo'`, no filePath, verify URI ends with `/specs/080-foo`.
    - "shows error when filePath does not exist" — pass a non-existent filePath, mock `fs.stat` to reject, verify `showErrorMessage` is called.
  - **Verify**: `npm test -- specCommands` passes; new cases green.
  - **Leverage**: existing test at line ~246 ("calls revealFileInOS with absolute folder URI resolved from specPath") as the structural template.
