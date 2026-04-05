# Implementation Plan: Fix Plan Sub-files Indentation in Sidebar

**Branch**: `049-fix-plan-indent` | **Date**: 2026-04-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/049-fix-plan-indent/spec.md`

## Summary

Fix early-return bug in `getStepSubFiles()` that prevents Plan step from combining both `subFiles` (research, data-model, quickstart) and `subDir` (contracts/) into its child items, causing Plan children to be incomplete in the sidebar tree.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`)
**Storage**: File-based (workspace `.claude/specs/` directories)
**Testing**: Jest with ts-jest, VS Code mock
**Target Platform**: VS Code extension (cross-platform)
**Project Type**: Single VS Code extension
**Performance Goals**: N/A (tree view rendering, negligible perf impact)
**Constraints**: Must preserve existing tree behavior for all other steps
**Scale/Scope**: Single method fix in one file

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Extensibility | PASS | No new code paths; existing config model preserved |
| II. Spec-Driven Workflow | PASS | Fix enhances sidebar's representation of the pipeline |
| III. Visual and Interactive | PASS | Fix restores correct visual hierarchy |
| IV. Modular Architecture | PASS | Change is within existing module boundaries |

**Post-Phase 1 Re-check**: All gates still PASS. Single-method fix, no architectural changes.

## Project Structure

### Documentation (this feature)

```text
specs/049-fix-plan-indent/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/features/specs/
└── specExplorerProvider.ts    # THE FIX: getStepSubFiles() method (lines 376-411)
```

**Structure Decision**: No new files. Single method modification in existing provider.
