# Plan: Optional SpecKit Initialization

**Spec**: [spec.md](./spec.md) | **Date**: 2026-03-26

## Approach

Remove all gates that block core functionality behind `speckit.detected` / `workspaceInitialized`. The extension should always show spec-related UI and commands. SpecKit detection shifts from a gate to a feature flag — when detected, extra SpecKit-specific features (constitution node, CLI commands) light up, but nothing is hidden or blocked when absent. The `speckit.create` command and all phase commands work unconditionally, reading/writing to configured spec directories.

## Files

### Modify

| File | Change |
|------|--------|
| `package.json` | **Welcome views**: Replace the 3 conditional welcome views (`!speckit.cliInstalled`, `cliInstalled && !detected`, `detected`) with a single unconditional "Create New Spec" view. **Command palette**: Remove `"when": "speckit.detected"` from all spec workflow commands (create, specify, plan, tasks, implement, clarify, analyze, checklist). Keep `speckit.detected` only on `speckit.constitution` (it's SpecKit-specific). **Menus**: Remove `speckit.detected` condition from the create button in `view/title`. **Keybindings**: Remove `speckit.detected` from `cmd+shift+n`. |
| `src/features/specs/specCommands.ts` | Remove the `workspaceInitialized` guard (lines 32–41) from the `speckit.create` handler — always open the spec editor. |
| `src/speckit/detector.ts` | Remove the `_isInitialized` guard from `createSpec()` (lines 275–284). Keep `checkWorkspaceInitialized()` and `checkConstitutionSetup()` intact since they're used to light up optional SpecKit features. |
| `src/extension.ts` | Make `showInitSuggestion` non-blocking: wrap in a fire-and-forget call (no `await`) so it doesn't delay activation. Keep it as-is otherwise — it's already dismissable. Same for `showConstitutionSetupSuggestion`. Always set `speckit.detected` to `true` for UI purposes (or remove the context key dependency entirely by updating package.json conditions). |

## Risks

- **Welcome view fallback**: If we remove all `when` conditions, VS Code shows whichever view matches. Need to ensure only one welcome view is active at a time by keeping the "Install CLI" view behind `!speckit.cliInstalled` as an optional enhancement, or collapsing to a single view. Safest approach: single unconditional welcome view with "Create New Spec" + optional "Install SpecKit CLI" link.
