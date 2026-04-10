# Implementation Plan: Fix Bullet Point Rendering

**Branch**: `055-fix-bullet-rendering` | **Date**: 2026-04-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/055-fix-bullet-rendering/spec.md`

## Summary

Fix three rendering bugs in the spec viewer's markdown-to-HTML pipeline: (1) ordered list counters reset to 1 when code blocks appear between items, (2) fenced code blocks after list items render as plain text instead of formatted code, and (3) excessive spacing between list items caused by list fragmentation. The fix involves tracking list counter state across interruptions and using `<ol start="N">` to resume numbering.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)
**Primary Dependencies**: VS Code Extension API, Preact (webview)
**Storage**: N/A (rendering-only change)
**Testing**: Jest with ts-jest
**Target Platform**: VS Code webview (browser context)
**Project Type**: Single VS Code extension
**Performance Goals**: No performance regression in rendering
**Constraints**: Must not break existing correctly-rendered content
**Scale/Scope**: Single file change (renderer.ts), minor CSS if needed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Extensibility and Configuration | PASS | Bug fix, no new feature/provider |
| II. Spec-Driven Workflow | PASS | Improves spec viewing quality |
| III. Visual and Interactive | PASS | Fixes visual rendering bugs |
| IV. Modular Architecture | PASS | Change is within existing renderer module |

**Post-Phase 1 Re-check**: All gates still pass. Fix is localized to the rendering pipeline within the modular spec-viewer architecture.

## Project Structure

### Documentation (this feature)

```text
specs/055-fix-bullet-rendering/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Root cause analysis
├── data-model.md        # State tracking changes
├── quickstart.md        # Implementation guide
├── checklists/
│   └── requirements.md  # Quality checklist
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
webview/
├── src/
│   └── spec-viewer/
│       └── markdown/
│           └── renderer.ts    # PRIMARY: list counter tracking & code block context
└── styles/
    └── spec-viewer/
        └── _typography.css    # MINOR: list spacing adjustments if needed
```

**Structure Decision**: All changes are within the existing `webview/` directory — no new files or directories needed. The renderer module already handles all list and code block logic.

## Complexity Tracking

> No constitution violations. No complexity justification needed.
