# Implementation Plan: SpecKit Views Enhancement

**Branch**: `005-speckit-views-enhancement` | **Date**: 2026-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-speckit-views-enhancement/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature enhances the SpecKit Companion VS Code extension with two primary changes:
1. **Contextual initialization message**: The "SpecKit CLI detected! Initialize this workspace..." message should only appear when a valid workspace/project is selected, not when VS Code is opened without a workspace.
2. **SpecKit files in steering view**: Display SpecKit-generated files (constitution.md, scripts, templates) in the steering view panel, organized by category for easy access and management.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode enabled)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`), js-yaml ^4.1.0
**Storage**: File system (`.specify/` directory structure in workspace)
**Testing**: Jest 29.7+ with ts-jest
**Target Platform**: VS Code ^1.84.0 (Windows, macOS, Linux)
**Project Type**: Single project (VS Code extension)
**Performance Goals**: Steering view updates within 2 seconds (per SC-004)
**Constraints**: Must work across all supported VS Code platforms, reactive to file system changes
**Scale/Scope**: Extension with ~7 tree views, targeting typical SpecKit projects with 10-50 specs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Extensibility and Configuration
- **Status**: ✅ PASS
- **Assessment**: This feature does not introduce new AI provider logic. It enhances existing UI views (steering) which already work across all supported providers. No provider-specific code changes required.

### II. Spec-Driven Workflow
- **Status**: ✅ PASS
- **Assessment**: This feature enhances visibility into SpecKit configuration files (constitution, scripts, templates) which are foundational to the spec-driven workflow. It supports the core workflow by making these files accessible through the UI.

### III. Visual and Interactive
- **Status**: ✅ PASS
- **Assessment**: Both user stories add visual components:
  - US1: Improves UX by removing confusing prompts when no workspace context exists
  - US2/US3: Adds new tree view items to display and organize SpecKit files visually in the steering panel

## Project Structure

### Documentation (this feature)

```text
specs/005-speckit-views-enhancement/
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
├── extension.ts              # Main entry point - init message logic (US1)
├── core/
│   ├── types.ts              # Shared types
│   └── utils/                # Utility functions
├── features/
│   └── steering/
│       ├── index.ts
│       ├── steeringManager.ts        # Business logic for steering operations
│       ├── steeringExplorerProvider.ts # Tree view provider (US2, US3 modifications)
│       └── steeringCommands.ts       # Command handlers
├── ai-providers/             # Provider integrations (no changes expected)
└── speckit/
    └── specKitDetector.ts    # SpecKit detection logic (may be referenced)
```

**Structure Decision**: This is a VS Code extension following the single project pattern. The feature primarily modifies:
1. `src/extension.ts` - For workspace detection before showing init message
2. `src/features/steering/steeringExplorerProvider.ts` - For displaying SpecKit files in steering view

## Complexity Tracking

> **No violations identified.** All constitution principles are satisfied.

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion.*

### I. Extensibility and Configuration
- **Status**: ✅ PASS (unchanged)
- **Post-Design Assessment**: The design adds SpecKit file detection to existing `SteeringExplorerProvider` without modifying AI provider logic. The implementation reuses existing patterns (context values, ThemeIcons) that already work across all providers.

### II. Spec-Driven Workflow
- **Status**: ✅ PASS (unchanged)
- **Post-Design Assessment**: The data model and contracts enhance visibility of core SpecKit workflow files (constitution, scripts, templates). This directly supports the Spec -> Plan -> Tasks workflow by making configuration files easily accessible.

### III. Visual and Interactive
- **Status**: ✅ PASS (unchanged)
- **Post-Design Assessment**: The quickstart.md demonstrates a fully visual implementation:
  - Tree view hierarchy with collapsible categories
  - ThemeIcons for visual distinction
  - Click-to-open interactions
  - File watcher for reactive updates

---

## Generated Artifacts

| Artifact | Status | Path |
|----------|--------|------|
| Implementation Plan | ✅ Complete | `specs/005-speckit-views-enhancement/plan.md` |
| Research | ✅ Complete | `specs/005-speckit-views-enhancement/research.md` |
| Data Model | ✅ Complete | `specs/005-speckit-views-enhancement/data-model.md` |
| Contracts | ✅ Complete | `specs/005-speckit-views-enhancement/contracts/` |
| Quickstart | ✅ Complete | `specs/005-speckit-views-enhancement/quickstart.md` |
| Tasks | ⏳ Pending | Run `/speckit.tasks` to generate |
