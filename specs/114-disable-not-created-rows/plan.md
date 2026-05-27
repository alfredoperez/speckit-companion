# Plan: Disable Not Created Rows

**Spec**: [spec.md](./spec.md)

## Approach

Drop the `command` argument on `SpecItem` construction when a step file's resolved `status` is `'empty'`. The `command` property is what VS Code's TreeView uses to wire row activation; setting it to `undefined` makes the row inert on click while leaving label, description, icon, `contextValue`, and the right-click menu intact.

## Files to Change

- `src/features/specs/specExplorerProvider.ts` — at the `new SpecItem(...)` call that builds step rows (around line 602), pass `status === 'empty' ? undefined : createOpenCommand(resolvedFilePath, `Open ${label}`)` instead of always calling `createOpenCommand(...)`. Single-site change; no other call to `createOpenCommand` exists.
