# Plan: Copy Spec Path / Name

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-27

## Approach

Add two new commands (`speckit.specs.copyPath`, `speckit.specs.copyName`) following the exact pattern used by `speckit.specs.reveal`/`speckit.specs.revealInExplorer` in `src/features/specs/specCommands.ts`: each handler resolves the spec slug from the tree item (`item.specPath` with `specs/${item.label}` fallback), writes to `vscode.env.clipboard`, and confirms via `NotificationUtils.showAutoDismissNotification`. Wire both into `package.json` `contributes.commands`, `view/item/context` (new `9_clipboard` group, restricted to `^spec-(active|tasks-done|completed|archived)$`), and `commandPalette` with `when: false` so they stay sidebar-only.

## Technical Context

**Stack**: TypeScript 5.3+ (ES2022, strict), VS Code Extension API (`@types/vscode ^1.84.0`), Jest + ts-jest for tests
**Key Dependencies**: `vscode.env.clipboard.writeText` (built-in), `NotificationUtils.showAutoDismissNotification` (existing)
**Constraints**: No platform branching — clipboard must work on macOS/Windows/Linux uniformly; menu entries must be hidden from the command palette since they require a tree-item argument.

## Files

### Create

- _(none)_ — fully reuses existing modules

### Modify

- `package.json` — declare two new commands under `contributes.commands`, add two `view/item/context` entries in a new `9_clipboard` group, add two `commandPalette` entries with `when: false`
- `src/features/specs/specCommands.ts` — register the two new command handlers next to the existing reveal handlers (same workspace + slug-resolution pattern, plus `vscode.env.clipboard.writeText`)
- `src/features/specs/specCommands.test.ts` — BDD-style tests for both handlers (clipboard write, notification, fallback path when `specPath` is missing)
- `README.md` — extend the "Sidebar at a Glance" section with the new context-menu entries
- `docs/sidebar.md` — document the two new right-click actions in the right-click menu reference table

## Testing Strategy

- **Unit (Jest)**: For each handler, assert `vscode.env.clipboard.writeText` is called with the expected string for both shapes — `(a)` an item with `specPath = "specs/089-copy-spec-path-name"`, and `(b)` an item with only `label` set (fallback path). Assert `NotificationUtils.showAutoDismissNotification` is invoked.
- **Mock additions**: Add `env.clipboard.writeText` to `tests/__mocks__/vscode.ts` if not already present.
- **Edge cases from spec**: legacy item without `specPath`; document/group context values must not show the entry (verified by `package.json` `when` clause review, not runtime).

## Risks

- _(none — additive feature with no shared state, no migration, no existing behavior changed)_
