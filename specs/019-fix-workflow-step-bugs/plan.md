# Implementation Plan: Fix Workflow Step Bugs

**Branch**: `019-fix-workflow-step-bugs` | **Date**: 2026-03-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/019-fix-workflow-step-bugs/spec.md`
**Dependency**: Spec 018 (Flexible Workflow Steps) must be implemented first

## Summary

Fix 5 bugs in the flexible workflow steps feature (018): incorrect icon mapping for custom step names, missing action-only step rendering, broken command dispatch for custom step commands, shallow subfile indentation, and legacy-key-only `buildWorkflowDetail()`. Also add step-level `icon` customization.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`)
**Storage**: File-based (`.speckit.json`, workspace `.claude/specs/`)
**Testing**: Manual testing via Extension Development Host (F5)
**Target Platform**: VS Code desktop (all platforms)
**Project Type**: Single (VS Code extension)
**Performance Goals**: N/A (UI bug fixes, no perf-critical paths)
**Constraints**: Must be backward-compatible with existing workflows
**Scale/Scope**: 5 files modified, ~150 lines changed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Extensibility and Configuration | PASS | `icon` property is additive; icon map is extensible without code changes |
| II. Spec-Driven Workflow | PASS | Fixes bugs that break the workflow for custom step configurations |
| III. Visual and Interactive | PASS | Directly improves visual correctness (icons, indentation, action-only rendering) |
| IV. Modular Architecture | PASS | Changes are in existing modules; no new large modules needed |

**Post-Phase 1 re-check**: All gates still pass. No new modules, no architectural changes.

## Project Structure

### Documentation (this feature)

```text
specs/019-fix-workflow-step-bugs/
├── spec.md              # Feature spec
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (files to modify)

```text
src/
├── features/
│   ├── specs/
│   │   └── specExplorerProvider.ts   # Icon map, action-only steps, subfile indent
│   └── workflows/
│       ├── types.ts                  # Add icon to WorkflowStepConfig
│       ├── workflowManager.ts        # Fix resolveStepCommand for steps array
│       └── workflowSelector.ts       # Fix buildWorkflowDetail for steps array
└── package.json                      # Add icon to step schema
```

**Structure Decision**: No new files needed. All changes are targeted fixes to existing modules.

## Design Decisions

### D1: Icon Resolution (R001, R006)

Add `STEP_ICON_MAP` constant mapping step names to ThemeIcon ids. Resolution order:
1. `step.icon` (explicit config override)
2. `STEP_ICON_MAP[step.name]` (built-in mapping)
3. Fallback: `file` for file-producing steps, `terminal` for action-only steps

See [data-model.md](./data-model.md) for the full map.

### D2: Action-Only Step Detection (R002)

A step is action-only when:
- `step.file` is undefined/null AND
- `{step.name}.md` does not exist on disk

Action-only steps render with `play` icon, no status indicator, and dispatch the step command on click.

### D3: Command Dispatch Fix (R003)

`resolveStepCommand()` must look up the step by name in the workflow's `steps` array and return its `command` field. The legacy `step-${name}` key lookup is removed (handled by 018's normalization).

### D4: Subfile Indentation (R004)

Ensure related docs are returned exclusively as children of their parent step via `getChildren()`, not at the same tree level. VS Code's native tree indentation handles the visual depth automatically when nesting is correct.

### D5: buildWorkflowDetail Update (R005)

Iterate `workflow.steps` (when present) instead of checking 4 hard-coded `step-*` keys. Display format: `Steps: specify → design → implement`.

## Complexity Tracking

No constitution violations — table not needed.
