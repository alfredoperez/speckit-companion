# Implementation Plan: Context-Driven Badges and Dates

**Branch**: `044-context-driven-badges` | **Date**: 2026-04-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/044-context-driven-badges/spec.md`

## Summary

Replace markdown-derived badge and date display in the spec viewer with `.spec-context.json` as the single source of truth. Badge text is already context-driven via `computeBadgeText()` — this feature extends that pattern to dates (Created/Last Updated) and ensures graceful omission when context fields are missing.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`)
**Storage**: `.spec-context.json` per spec directory (file-based)
**Testing**: Jest with ts-jest, BDD style (`describe`/`it`)
**Target Platform**: VS Code extension (Node.js + webview browser context)
**Project Type**: Single (VS Code extension with webview)
**Performance Goals**: N/A (UI rendering, no latency-critical path)
**Constraints**: Must degrade gracefully when `.spec-context.json` is absent or malformed
**Scale/Scope**: ~10 files modified, scoped to spec-viewer feature

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Extensibility and Configuration | PASS | Uses existing `specContextManager` API; no new hard-coded logic |
| II. Spec-Driven Workflow | PASS | Reinforces spec-context.json as single source of truth for lifecycle state |
| III. Visual and Interactive | PASS | Enhances visual badge/date display with real-time updates |
| IV. Modular Architecture | PASS | Changes scoped to existing modules (preprocessors, phaseCalculation, navigation); no new complex features requiring new module structure |

No violations. All changes align with existing patterns and principles.

## Project Structure

### Documentation (this feature)

```text
specs/044-context-driven-badges/
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
│   ├── spec-viewer/
│   │   ├── phaseCalculation.ts    # computeBadgeText() — already context-driven, minor adjustments
│   │   ├── specViewerProvider.ts  # NavState population — add date fields
│   │   ├── types.ts               # NavState interface — add date fields
│   │   ├── html/generator.ts      # Initial HTML generation — render context dates
│   │   └── messageHandlers.ts     # Lifecycle actions — already update spec-context
│   ├── specs/
│   │   └── specContextManager.ts  # Read/write spec-context — no changes needed
│   └── workflows/
│       └── types.ts               # FeatureWorkflowContext — no changes needed (stepHistory already exists)

webview/
├── src/
│   └── spec-viewer/
│       ├── markdown/preprocessors.ts  # preprocessSpecMetadata() — skip date parsing when context dates provided
│       ├── navigation.ts              # updateNavState() — add dynamic date updates
│       └── index.ts                   # Message handler — pass date data through
└── styles/
    └── spec-viewer/                   # Minor CSS adjustments if needed

tests/
├── phaseCalculation.test.ts           # Badge computation tests
└── preprocessors.test.ts             # Date rendering tests (new)
```

**Structure Decision**: All changes fit within the existing modular structure. No new modules needed.

## Complexity Tracking

> No constitution violations. No complexity justifications needed.
