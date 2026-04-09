# Implementation Plan: Archive Button Left Alignment

**Branch**: `054-archive-button-left` | **Date**: 2026-04-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/054-archive-button-left/spec.md`

## Summary

Move the Archive button from the right-side action group to the left-side action group in the spec viewer footer. This separates destructive actions (Archive) from forward-progress actions (Regenerate, Approve, Complete, Reactivate), following standard UI patterns that distance destructive actions from primary actions.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)  
**Primary Dependencies**: VS Code Extension API, Preact (webview)  
**Storage**: File-based (`.spec-context.json` per spec directory)  
**Testing**: Jest with ts-jest  
**Target Platform**: VS Code Extension (webview)  
**Project Type**: Single VS Code extension  
**Performance Goals**: N/A (UI layout change only)  
**Constraints**: Must work across all VS Code panel widths  
**Scale/Scope**: Single component change in FooterActions.tsx

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Extensibility and Configuration | PASS | No new features; layout change only |
| II. Spec-Driven Workflow | PASS | Respects spec lifecycle — Archive hidden when archived, visible in all other states |
| III. Visual and Interactive | PASS | Improves visual distinction between destructive and progression actions |
| IV. Modular Architecture | PASS | Change is contained within existing FooterActions component |

**Gate Result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/054-archive-button-left/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (files to modify)

```text
webview/src/spec-viewer/components/FooterActions.tsx   # Move Archive button to actions-left
webview/styles/spec-viewer/_footer.css                 # No changes expected (layout already supports left/right)
docs/viewer-states.md                                  # Update footer button matrix documentation
```

## Complexity Tracking

> No violations — table not needed.
