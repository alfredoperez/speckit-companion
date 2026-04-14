# Plan: Multi Select Specs

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-13

## Approach

Migrate the Specs sidebar from `registerTreeDataProvider` to `createTreeView` with `canSelectMany: true`, then adapt the three status commands (`markCompleted`, `archive`, `reactivate`) to operate on the full selection. Use VS Code context keys derived from the selection's statuses to drive conditional `when` clauses for context-menu visibility, giving intersection semantics without custom menu code.

## Technical Context

**Stack**: TypeScript 5.3+, VS Code Extension API (`@types/vscode ^1.84.0`)
**Constraints**: Extension-only change; no `.claude/**` or `.specify/**` edits. Single-select behavior must remain unchanged.

## Files

### Create

- `src/features/specs/selectionContextKeys.ts` — compute and set `speckit.specs.selection.*` VS Code context keys (e.g., `allActive`, `allCompleted`, `allArchived`, `mixed`, `count`) from the tree view's current selection.

### Modify

- `src/extension.ts` — replace `registerTreeDataProvider(Views.explorer, specExplorer)` with `vscode.window.createTreeView(Views.explorer, { treeDataProvider: specExplorer, canSelectMany: true })`; wire `onDidChangeSelection` to the new selection-context-keys module; keep the TreeView in subscriptions.
- `src/features/specs/specCommands.ts` — change `speckit.markCompleted`, `speckit.archive`, and `speckit.reactivate` (if not yet registered here, add it) to accept `(item, items?)` signature per VS Code multi-select convention, iterate the selection, call `setStatus`/`reactivate` per spec, refresh the tree once, and show a single summary toast (e.g., `"3 specs marked as completed"`; singular form when count is 1).
- `package.json` — update `menus.view/item/context` entries for the three commands: add `when` clauses gating on the new `speckit.specs.selection.*` context keys so "Mark as Complete" hides when `allCompleted`, "Move to Active" hides when `allActive`, and any status-specific action hides on `mixed` selection where it isn't valid for every selected spec. Register `speckit.reactivate` command contribution if missing.
- `src/features/specs/specCommands.test.ts` — add tests for bulk handlers: multi-item invocation updates all, single toast, single refresh, single-select fallback unchanged.

## Testing Strategy

- **Unit**: Extend `specCommands.test.ts` — mock `setStatus`/`reactivate` and assert they're called once per selected spec, that `specExplorer.refresh()` is called exactly once per bulk invocation, and that the notification message reflects the count.
- **Manual**: Launch Extension Development Host, Ctrl/Cmd-click three active specs → "Mark as Complete" → verify single toast, tree refresh, all three move. Right-click two already-completed specs → verify "Mark as Complete" is hidden. Select one active + one completed → verify only actions valid for both appear. Right-click a single item → verify behavior is unchanged.

## Risks

- **Context-key staleness**: If selection context keys are set only on `onDidChangeSelection`, a right-click that changes selection may race with menu evaluation. Mitigation: also update the keys synchronously at the start of each bulk command as a safety net, and rely on VS Code's standard behavior that right-click updates selection before the menu opens.
- **Single-item invocation from keyboard/palette**: When a command is invoked without a TreeView selection (e.g., Command Palette), the `items` arg is undefined. Mitigation: fall back to `[item]` when `items` is falsy, preserving today's single-spec behavior (R001 scenario: Single-select fallback).
