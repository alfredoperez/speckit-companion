# Research: Fix Workflow Step Bugs

**Spec**: [spec.md](./spec.md) | **Date**: 2026-03-19

## R1: Icon Mapping Strategy for Dynamic Step Names

**Decision**: Create a `STEP_ICON_MAP` lookup that maps both legacy names (`spec`, `plan`, `tasks`) and new step names (`specify`, `design`, `implement`, `explore`, `verify`, `archive`) to VS Code ThemeIcons. Support a per-step `icon` override in `WorkflowStepConfig`. Unrecognized names fall back to `terminal` (action-only) or `file` (file-producing).

**Rationale**: The current icon logic in `SpecItem` (specExplorerProvider.ts:319-328) uses a simple if/else chain matching only `spec`, `plan`, `tasks`. This breaks for any new step name introduced by 018's flexible steps. A map-based approach is extensible without code changes for each new name.

**Alternatives considered**:
- Regex-based icon inference (e.g., names containing "test" get test icon) — too fragile and surprising
- No default mapping, require explicit `icon` on every step — poor DX for common workflows

## R2: Action-Only Step Detection

**Decision**: A step is "action-only" when it has no `file` property AND its default file (`{name}.md`) does not exist on disk. Action-only steps render with a `play` icon, no status indicator, and a click action that dispatches the command directly instead of opening a file.

**Rationale**: Steps like `implement` or `verify` often don't produce output documents. Showing them with a file icon and "not started" status is misleading. The `file` property presence (or absence + disk check) is the cleanest discriminator since it's already part of the `WorkflowStepConfig` from 018.

**Alternatives considered**:
- Explicit `actionOnly: boolean` flag — adds another config property when absence of `file` already conveys this
- Always show status indicator — confusing UX for steps that never produce files

## R3: Command Dispatch for Custom Steps

**Decision**: `resolveStepCommand()` must read from the step's `command` field in `WorkflowStepConfig` rather than building `step-{name}` keys. The `getOrSelectWorkflow()` auto-selection must respect `speckit.defaultWorkflow` setting before falling back to built-in default (this already works correctly per code review — the bug is in command resolution, not workflow selection).

**Rationale**: Current `resolveStepCommand()` (workflowManager.ts) builds `step-${step}` as a key into `WorkflowConfig`. After 018 introduces the `steps` array, this lookup must iterate the `steps` array and match by `name`.

**Alternatives considered**:
- Keep legacy key lookup alongside new array lookup — unnecessary complexity once 018 migration is complete

## R4: Subfile Indentation

**Decision**: Related doc tree items should use `TreeItemCollapsibleState` hierarchy correctly. The issue is that `spec-related-doc` items don't have visual indent differentiation from `spec-document` items. Fix by ensuring related docs are returned as children of their parent step (not siblings) and use VS Code's built-in tree indentation.

**Rationale**: VS Code tree views indent based on nesting depth. If related docs are correctly nested as children of a collapsible parent, indentation is automatic. The issue may be in how `getChildren()` returns items at the wrong level.

**Alternatives considered**:
- CSS-based indent override — not possible in native tree views
- Adding indent prefix to labels — hacky, breaks sorting and search

## R5: buildWorkflowDetail for Steps Array

**Decision**: Update `buildWorkflowDetail()` to iterate the `steps` array (when present) instead of checking individual `step-*` keys. Display format: `Steps: specify → plan → tasks` showing the workflow pipeline.

**Rationale**: After 018, workflows use `steps` array. The current code checks 4 hard-coded keys which won't reflect custom step configurations.

**Alternatives considered**:
- Keep both old and new format display — unnecessary once normalization handles compat
