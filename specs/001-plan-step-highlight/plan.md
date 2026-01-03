# Implementation Plan: Plan Step Highlight and Sub-menu Ordering

**Branch**: `001-plan-step-highlight` | **Date**: 2026-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-plan-step-highlight/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature ensures the Plan step in the workflow progress bar remains visually highlighted when viewing any sub-section (Research, Data Model, Quickstart, etc.) within the Plan step. Additionally, the sub-menu must display "Plan" as the first option, followed by remaining items in alphabetical order. The implementation primarily involves ensuring proper message passing between the extension and webview to update phase state when switching between plan sub-sections.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode enabled)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`), Webpack 5
**Storage**: N/A (no persistent storage required for this feature)
**Testing**: Manual testing via VS Code Extension Development Host (F5)
**Target Platform**: VS Code ^1.84.0 (Windows, macOS, Linux)
**Project Type**: VS Code Extension with webview components
**Performance Goals**: UI state updates within 100ms of navigation
**Constraints**: Must integrate with existing workflow editor webview architecture
**Scale/Scope**: Single feature affecting workflow editor phase stepper component

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Compliance | Notes |
|-----------|-------------|------------|-------|
| I. Extensibility and Configuration | Provider-agnostic design | ✅ PASS | This feature affects only the workflow editor UI, not AI provider logic |
| II. Spec-Driven Workflow | Support Spec → Plan → Tasks workflow | ✅ PASS | Enhances the Plan step visual feedback, supporting the core workflow |
| III. Visual and Interactive | Visual component, interactive UI | ✅ PASS | Directly improves visual feedback and navigation UX |

**Gate Status**: ✅ PASSED - All constitutional requirements satisfied

## Project Structure

### Documentation (this feature)

```text
specs/001-plan-step-highlight/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command) - N/A for this feature
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/features/workflow-editor/
├── workflowEditorProvider.ts    # CustomTextEditorProvider - handles webview/extension messaging
├── workflow/
│   ├── specInfoParser.ts        # Phase detection and related docs parsing
│   ├── htmlGenerator.ts         # Generates phase stepper HTML
│   └── actionHandlers.ts        # Handles user actions (navigate, switchTab)

webview/
├── src/
│   ├── workflow.ts              # Main webview entry - event listeners, message handling
│   ├── ui/
│   │   └── phaseUI.ts           # Updates phase step visual states (key file)
│   └── render/
│       └── contentRenderer.ts   # Renders markdown content
└── styles/
    └── workflow.css             # Phase stepper styling (active, completed states)
```

**Structure Decision**: VS Code Extension architecture with webview for custom editors. Extension-side code in `src/` communicates with browser-side webview code in `webview/src/` via postMessage API.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations - all constitutional requirements satisfied. This feature is a straightforward UI enhancement with minimal complexity.

---

## Implementation Notes

### Key Findings from Codebase Analysis

1. **Sub-menu ordering already implemented**: `specInfoParser.ts` already places Plan.md first, then sorts other docs alphabetically (lines 118-134). This part of the feature may already be working.

2. **Phase detection logic is correct**: `parseSpecInfo()` correctly identifies all .md files in the plan folder as `currentPhase: 2`, which should trigger the Plan step highlight.

3. **The gap**: When switching tabs between plan sub-sections, the `updatePhaseInfo` message may not be sent to the webview, causing the highlight to not update.

### Files to Modify

1. **`src/features/workflow-editor/workflowEditorProvider.ts`**
   - Ensure `updatePhaseInfo` message is sent after tab/document switch

2. **`src/features/workflow-editor/workflow/actionHandlers.ts`**
   - `switchToDocument()` may need to trigger phase info update after file switch

3. **`webview/src/ui/phaseUI.ts`**
   - Verify the highlighting logic handles all plan sub-sections correctly

### Existing Infrastructure to Leverage

- CSS for `.step.active` state already provides the visual highlight (ring + glow)
- Message type `updatePhaseInfo` already defined in types
- `updatePhaseUI()` function already handles the class toggling logic

---

## Post-Design Constitution Check

*Re-evaluation after Phase 1 design artifacts completed.*

| Principle | Requirement | Compliance | Notes |
|-----------|-------------|------------|-------|
| I. Extensibility and Configuration | Provider-agnostic design | ✅ PASS | Design confirms no AI provider-specific logic introduced |
| II. Spec-Driven Workflow | Support Spec → Plan → Tasks workflow | ✅ PASS | Enhances Plan phase visibility across all sub-documents |
| III. Visual and Interactive | Visual component, interactive UI | ✅ PASS | Uses existing CSS visual infrastructure for step highlighting |

**Post-Design Gate Status**: ✅ PASSED

**Design Review Notes**:
- No new dependencies introduced
- Leverages existing message passing infrastructure
- Minimal code changes required (potentially just verification that existing code works)
- Sub-menu ordering already correctly implemented

---

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| plan.md | `specs/001-plan-step-highlight/plan.md` | ✅ Complete |
| research.md | `specs/001-plan-step-highlight/research.md` | ✅ Complete |
| data-model.md | `specs/001-plan-step-highlight/data-model.md` | ✅ Complete |
| quickstart.md | `specs/001-plan-step-highlight/quickstart.md` | ✅ Complete |
| contracts/ | N/A | ⏭️ Skipped (no API) |
| tasks.md | Pending `/speckit.tasks` command | ⏳ Next step |
