# Plan: Fix Grayish Step Names

**Spec**: [spec.md](./spec.md) | **Date**: 2026-03-31

## Approach

Remove `resourceUri` from spec TreeItems to prevent VS Code's git-decoration dimming. Store the file path in the TreeItem's `command.arguments` instead so inline actions and click-to-open still work.

## Files to Change

- `src/features/specs/specExplorerProvider.ts` — Remove `resourceUri` assignment, pass path via command arguments
- `src/features/specs/specCommands.ts` — Update to read file path from command arguments instead of `resourceUri`
