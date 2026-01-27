# Implementation Plan: Custom Workflows

**Branch**: `001-custom-workflows` | **Date**: 2026-01-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-custom-workflows/spec.md`

## Summary

Enable users to define custom workflows with configurable step mappings (specify, plan, implement) via VS Code settings. The feature includes workflow selection when multiple workflows are available, step-to-command mapping, and optional checkpoint definitions for lightweight workflow variants that automate commit and PR generation.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`), Webpack 5
**Storage**: File-based in `.claude/` directory structure for feature context persistence
**Testing**: Jest 29.7.0 with ts-jest
**Target Platform**: VS Code ^1.84.0 (cross-platform: macOS, Windows, Linux)
**Project Type**: Single (VS Code extension with Node.js backend + webview UI)
**Performance Goals**: Workflow selection adds no more than 5 seconds to spec generation
**Constraints**: Must integrate with existing AI provider architecture, maintain backwards compatibility with default workflow
**Scale/Scope**: Single VS Code extension, workspace-scoped configurations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Extensibility and Configuration** | ✅ PASS | Workflows are configurable via settings; design allows for future workflow types |
| **II. Spec-Driven Workflow** | ✅ PASS | Feature enhances the Spec → Plan → Tasks workflow by allowing custom command mappings |
| **III. Visual and Interactive** | ✅ PASS | Workflow selection uses VS Code QuickPick; checkpoints provide interactive prompts |
| **IV. Modular Architecture** | ✅ PASS | Implementation follows manager/provider pattern; workflow logic isolated in dedicated module |

**Pre-Design Gate**: PASSED - All principles satisfied

## Project Structure

### Documentation (this feature)

```text
specs/001-custom-workflows/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── types/
│   │   └── config.ts           # Add WorkflowConfig, CheckpointConfig interfaces
│   └── constants.ts            # Add workflow-related constants
├── features/
│   └── workflows/              # NEW: Custom workflows feature module
│       ├── index.ts            # Module exports
│       ├── workflowManager.ts  # Workflow CRUD, validation, persistence
│       ├── workflowSelector.ts # QuickPick workflow selection UI
│       ├── checkpointHandler.ts # Checkpoint prompt and git operations
│       └── types.ts            # Workflow-specific type definitions
├── features/specs/
│   └── specCommands.ts         # Modify to integrate workflow selection
└── extension.ts                # Register workflow-related commands

tests/
└── features/
    └── workflows/
        ├── workflowManager.test.ts
        ├── workflowSelector.test.ts
        └── checkpointHandler.test.ts
```

**Structure Decision**: VS Code extension single-project structure. New `workflows` feature module follows the established Manager pattern. Integration points in existing `specs` feature and `extension.ts`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations - all constitution principles satisfied.

## Post-Design Constitution Re-Check

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| **I. Extensibility and Configuration** | ✅ PASS | `speckit.customWorkflows` setting is extensible; new checkpoint types can be added |
| **II. Spec-Driven Workflow** | ✅ PASS | Design maintains Spec → Plan → Tasks flow; custom commands are variants, not replacements |
| **III. Visual and Interactive** | ✅ PASS | QuickPick for workflow selection; confirmation dialogs for checkpoints |
| **IV. Modular Architecture** | ✅ PASS | `workflows/` module with separate manager, selector, and handler files |

**Post-Design Gate**: PASSED

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Research | `specs/001-custom-workflows/research.md` | ✅ Complete |
| Data Model | `specs/001-custom-workflows/data-model.md` | ✅ Complete |
| API Contract | `specs/001-custom-workflows/contracts/workflow-api.ts` | ✅ Complete |
| Quickstart | `specs/001-custom-workflows/quickstart.md` | ✅ Complete |

## Next Steps

Run `/speckit.tasks` to generate implementation tasks based on this plan.
