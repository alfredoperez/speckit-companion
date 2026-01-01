# Implementation Plan: Edit Input Auto-Sizing with Original Value Display

**Branch**: `002-edit-input-sizing` | **Date**: 2025-12-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-edit-input-sizing/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enhance the VSCode webview editing experience by implementing auto-sizing text inputs that dynamically resize based on content, while displaying the original value for reference during editing. The implementation will extend the existing refine popover UI component with CSS-based dynamic sizing and a visual reference for the pre-edit value.

## Technical Context

**Language/Version**: TypeScript 5.3+ (strict mode enabled)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`), Webpack, vanilla TypeScript (no UI framework)
**Storage**: N/A (stateless UI component, values managed by parent context)
**Testing**: Jest with ts-jest transformer, node environment (no DOM - webview tests may need jsdom)
**Target Platform**: VS Code Extension (webview), cross-platform (Windows, macOS, Linux)
**Project Type**: Single project (VS Code extension with webview)
**Performance Goals**: Input resizing within 50ms per keystroke (SC-004), no visual jitter during rapid typing
**Constraints**: Must work within VS Code webview sandbox, CSS Custom Properties theming, no external dependencies
**Scale/Scope**: Single webview component, ~3-5 files modified, existing refine popover pattern

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check (Phase 0 Gate)

| Principle | Requirement | Status | Notes |
|-----------|-------------|--------|-------|
| I. Extensibility | Provider-agnostic design | ✅ PASS | UI component is provider-independent; works with any AI provider |
| I. Extensibility | Configuration exposed to user | ✅ PASS | No user configuration needed; auto-sizing is automatic |
| II. Spec-Driven | Supports Spec→Plan→Tasks workflow | ✅ PASS | Enhances editing experience within workflow editor |
| II. Spec-Driven | Non-negotiable workflow preserved | ✅ PASS | Feature enhances, does not alter, core workflow |
| III. Visual/Interactive | Visual component within VS Code UI | ✅ PASS | Primary deliverable is enhanced visual editing UX |
| III. Visual/Interactive | Interactive (not CLI-only) | ✅ PASS | Direct user interaction via webview inputs |

**Gate Result**: ✅ PASS - All constitution principles satisfied

## Project Structure

### Documentation (this feature)

```text
specs/002-edit-input-sizing/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# VS Code Extension with Webview (existing structure)
src/                              # Extension host code (Node.js)
├── features/
│   └── workflow-editor/
│       ├── workflowEditorProvider.ts  # Webview provider
│       └── workflow/
│           └── actionHandlers.ts      # Message handlers
└── ...

webview/                          # Webview UI code (browser)
├── src/
│   ├── ui/
│   │   ├── index.ts              # UI barrel exports
│   │   └── refinePopover.ts      # Popover component (MODIFY)
│   ├── render/
│   │   └── lineRenderer.ts       # Line action buttons
│   ├── types.ts                  # Message types
│   └── workflow.ts               # Main webview entry
└── styles/
    └── workflow.css              # Webview styles (MODIFY)

tests/                            # Test files (to be created)
└── webview/
    └── ui/
        └── autoSizingInput.test.ts
```

**Structure Decision**: VS Code extension with webview. This feature primarily modifies the webview layer (`webview/src/ui/`, `webview/styles/`). No changes to extension host code required as the auto-sizing is purely a UI enhancement within the existing webview.

## Complexity Tracking

> **No violations - complexity tracking not required**

No constitution violations were identified. The implementation follows the simplest approach:
- CSS-first solution (`field-sizing: content`) with minimal JS
- Extends existing popover pattern rather than creating new components
- No new dependencies or abstractions introduced

---

## Post-Design Constitution Check

*Re-evaluated after Phase 1 design completion.*

| Principle | Requirement | Status | Post-Design Notes |
|-----------|-------------|--------|-------------------|
| I. Extensibility | Provider-agnostic design | ✅ PASS | Design confirmed: No provider-specific code. Works identically regardless of AI backend. |
| I. Extensibility | Configuration exposed to user | ✅ PASS | No configuration needed. Auto-sizing is automatic and universally beneficial. |
| II. Spec-Driven | Supports Spec→Plan→Tasks workflow | ✅ PASS | Enhances the refine action which is part of the spec editing workflow. |
| II. Spec-Driven | Non-negotiable workflow preserved | ✅ PASS | No changes to workflow stages or message protocol. |
| III. Visual/Interactive | Visual component within VS Code UI | ✅ PASS | New visual elements: original value reference, auto-sizing input. |
| III. Visual/Interactive | Interactive (not CLI-only) | ✅ PASS | User interacts via webview popover; no CLI involvement. |

**Post-Design Gate Result**: ✅ PASS - All principles validated against design artifacts

---

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Implementation Plan | `specs/002-edit-input-sizing/plan.md` | ✅ Complete |
| Research | `specs/002-edit-input-sizing/research.md` | ✅ Complete |
| Data Model | `specs/002-edit-input-sizing/data-model.md` | ✅ Complete |
| Quickstart | `specs/002-edit-input-sizing/quickstart.md` | ✅ Complete |
| Agent Context | `CLAUDE.md` | ✅ Updated |

---

## Next Steps

Run `/speckit.tasks` to generate the task breakdown for implementation.
