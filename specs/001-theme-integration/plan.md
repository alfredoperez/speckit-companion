# Implementation Plan: VS Code Theme Integration and Readability Improvements

**Branch**: `001-theme-integration` | **Date**: 2026-01-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-theme-integration/spec.md`

## Summary

Replace hardcoded dark theme colors in the workflow editor CSS with VS Code theme CSS custom properties to achieve automatic light/dark theme support. Additionally, improve typography by using VS Code's configured fonts and reduce excessive header margins for better content density.

## Technical Context

**Language/Version**: TypeScript 5.3+ (strict mode enabled)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`), Webpack, vanilla TypeScript (no UI framework)
**Storage**: N/A (CSS-only changes)
**Testing**: Manual testing with VS Code theme switching (light/dark/custom themes)
**Target Platform**: VS Code webviews (browser runtime)
**Project Type**: VS Code Extension with webview component
**Performance Goals**: Instant theme updates with 0 manual refresh
**Constraints**: Must use CSS-only solution; no runtime JS for color calculations
**Scale/Scope**: Single CSS file (`webview/styles/workflow.css`) ~970 lines

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Extensibility and Configuration
- ✅ **PASS**: This feature uses VS Code's native theme system rather than creating a custom theme selector, maintaining extensibility by delegating to the platform.
- ✅ **PASS**: No provider-specific logic required; pure CSS changes.

### II. Spec-Driven Workflow
- ✅ **PASS**: This feature enhances the spec workflow by improving the visual experience of the workflow editor (the core spec viewing tool).
- ✅ **PASS**: No changes to the Spec → Plan → Tasks workflow.

### III. Visual and Interactive
- ✅ **PASS**: This is purely a visual enhancement to the GUI experience.
- ✅ **PASS**: The primary interface remains the VS Code UI with improved visual consistency.

## Project Structure

### Documentation (this feature)

```text
specs/001-theme-integration/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output - VS Code theme variable research
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
webview/
├── styles/
│   └── workflow.css     # PRIMARY: Main CSS file requiring theme variable updates (~970 lines)
└── src/
    └── *.ts             # TypeScript files (no changes needed - CSS-only feature)

src/
└── features/
    └── workflowEditor/
        └── workflowEditorProvider.ts  # Webview provider (may need to pass theme context)
```

**Structure Decision**: This is a CSS-only feature affecting the webview styles. The primary file to modify is `webview/styles/workflow.css`. The `spec-markdown.css` already uses VS Code theme variables and serves as a reference implementation.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations - all constitution gates passed.*

---

## Post-Design Constitution Re-Check

*Re-evaluated after research.md completion (2026-01-01)*

### I. Extensibility and Configuration
- ✅ **PASS**: Design uses VS Code's native CSS custom properties (`--vscode-*`), ensuring automatic theme compatibility without custom configuration UI.

### II. Spec-Driven Workflow
- ✅ **PASS**: No impact on workflow logic; purely visual enhancement to the workflow editor.

### III. Visual and Interactive
- ✅ **PASS**: The research confirms a CSS-only approach with no JavaScript theme observers needed. Theme changes will update automatically through VS Code's CSS variable injection.

**Gate Status**: All gates passed. Proceed to task generation with `/speckit.tasks`.
