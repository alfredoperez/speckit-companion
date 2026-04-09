# Implementation Plan: Transition Logging

**Branch**: `052-transition-logging` | **Date**: 2026-04-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/052-transition-logging/spec.md`

## Summary

Add an append-only transition log to `.spec-context.json` that records every workflow step/substep change with source attribution (`extension` or `sdd`) and timestamps. Detect external (SDD) transitions via the file watcher and log them to the output channel. Display the full transition history as a color-coded timeline in the spec viewer.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`), Preact (webview)
**Storage**: File-based (`.spec-context.json` per spec directory)
**Testing**: Jest with `ts-jest`, VS Code mock (`tests/__mocks__/vscode.ts`)
**Target Platform**: VS Code desktop (all platforms)
**Project Type**: Single VS Code extension with webview UI
**Performance Goals**: Transition append must not add perceptible latency to step changes
**Constraints**: Append-only data model; must preserve SDD-written entries; no modification to SDD fields
**Scale/Scope**: Typically <50 transitions per spec; <100 specs per workspace

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Extensibility & Configuration | PASS | Uses existing workflow step resolution; works with custom workflows |
| II. Spec-Driven Workflow | PASS | Enhances the pipeline with audit trail; no changes to step definitions |
| III. Visual & Interactive | PASS | History section adds visual timeline to spec viewer |
| IV. Modular Architecture | PASS | Transition logic in dedicated module; History UI in separate component |
| AI Provider Integration | PASS | No provider-specific logic; works with all providers |
| User Interface | PASS | Adds section to existing spec viewer; uses VS Code theme variables |

**Re-check after Phase 1**: All gates still PASS. No new entities, abstractions, or external dependencies introduced beyond what's needed.

## Project Structure

### Documentation (this feature)

```text
specs/052-transition-logging/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── features/
│   ├── specs/
│   │   ├── specContextManager.ts      # MODIFY: add transition append in updateSpecContext()
│   │   └── transitionLogger.ts        # CREATE: transition cache + external detection helper
│   ├── spec-viewer/
│   │   ├── specViewerProvider.ts       # MODIFY: pass transitions + stepOrder to webview
│   │   ├── html/generator.ts          # MODIFY: accept transitions in generateHtml()
│   │   └── types.ts                   # MODIFY: add transitions to NavState
│   └── workflows/
│       └── types.ts                   # MODIFY: add TransitionEntry type + transitions field
├── core/
│   └── fileWatchers.ts                # MODIFY: add external transition detection

webview/
├── src/spec-viewer/
│   └── history/
│       └── TransitionHistory.tsx       # CREATE: History timeline component
└── styles/spec-viewer/
    └── _history.css                    # CREATE: timeline styles

tests/
├── unit/
│   ├── specContextManager.test.ts     # CREATE or EXTEND: transition append tests
│   └── transitionLogger.test.ts       # CREATE: cache + detection tests
```

**Structure Decision**: All new code fits within existing feature modules. One new file (`transitionLogger.ts`) encapsulates transition-specific logic to keep `specContextManager.ts` focused. One new Preact component for the History UI.

## Complexity Tracking

> No constitution violations. No complexity justifications needed.
