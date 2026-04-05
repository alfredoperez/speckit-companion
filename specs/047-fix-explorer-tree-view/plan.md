# Plan: Fix Explorer Tree View

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-05

## Approach

Fix three bugs in `specExplorerProvider.ts` by changing the step status icon logic to prefer `specContext.step` over `currentStep`, ensuring related docs render as indented children of their parent step, and verifying unregistered markdown file discovery attaches to the correct step. All changes are localized to a single file with existing patterns already in place.

## Technical Context

**Stack**: TypeScript, VS Code Extension API
**Key Dependencies**: `vscode.TreeDataProvider`, `SpecItem` tree item class

## Files

### Create

_(none)_

### Modify

- `src/features/specs/specExplorerProvider.ts` — Fix step status icon to prefer `step` field (line 587), verify related doc child rendering, verify unregistered doc discovery and attachment

## Testing Strategy

- **Unit**: Add tests for `SpecItem` constructor verifying icon selection when `step` and `currentStep` differ, when only `currentStep` is present, and when neither is set
- **Edge cases**: Spec with `step: "implement"` and `currentStep: "plan"` should show blue dot on Implement; spec with only `currentStep` should preserve existing behavior; related docs in subdirectories should appear as children not siblings
