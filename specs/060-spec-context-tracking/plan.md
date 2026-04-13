# Implementation Plan: Spec-Context Tracking & Viewer Status Feedback

**Branch**: `060-spec-context-tracking` | **Date**: 2026-04-13 | **Spec**: [spec.md](./spec.md)

## Summary

Make `.spec-context.json` the single source of truth for spec lifecycle state, with a canonical schema (`workflow`, `specName`, `branch`, `currentStep`, `status`, `stepHistory`, `transitions`). All four workflows (SpecKit terminal, SpecKit+Companion, SDD, SDD Fast) write the same shape via standardized prompt blocks. The viewer derives badges, pulse, highlight, and footer button visibility solely from this context — never from file existence.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022, strict)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`), Preact (webview)
**Storage**: File-based — `.spec-context.json` per spec dir under workspace `.claude/specs/`
**Testing**: Jest with `ts-jest`, BDD describe/it
**Target Platform**: VS Code 1.84+ (desktop)
**Project Type**: Single (VS Code extension with webview)
**Performance Goals**: Viewer badge/state updates <100ms after context file change
**Constraints**: Must tolerate unknown fields, never overwrite user edits, append-only transitions
**Scale/Scope**: ~7 files in spec viewer + ~6 prompt skill files + 1 schema module

## Constitution Check

- **I. Extensibility**: PASS — schema accepts unknown fields; workflows pluggable.
- **II. Spec-Driven Workflow**: PASS — reinforces explicit lifecycle, removes heuristic inference.
- **III. Visual and Interactive**: PASS — fixes pulse/highlight/badge correctness in viewer.
- **IV. Modular Architecture**: PASS — schema, reader/writer, viewer state derivation kept as separate modules.

No violations.

## Project Structure

### Documentation (this feature)

```text
specs/060-spec-context-tracking/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── spec-context.schema.json
└── tasks.md           # created later by /speckit.tasks
```

### Source Code (repository root)

```text
src/
├── core/
│   └── types/
│       └── specContext.ts            # canonical SpecContext types
├── features/
│   ├── specs/
│   │   ├── specContextReader.ts      # read + tolerate unknown fields
│   │   ├── specContextWriter.ts      # atomic write, append-only transitions
│   │   └── specContextBackfill.ts    # minimal context for terminal-only specs
│   └── spec-viewer/
│       ├── stateDerivation.ts        # status/badge/pulse from context only
│       ├── footerActions.ts          # scope + visibility rules
│       └── messageHandlers.ts        # (modify) wire context updates
webview/src/spec-viewer/
│   └── (badge/pulse/footer rendering reads derived state)

.claude/skills/
├── speckit-specify/, speckit-plan/, speckit-tasks/, speckit-implement/,
│   speckit-clarify/, speckit-analyze/    # add standard pre/post context-update block
└── sdd*/                                  # same standardized block

tests/
├── unit/specs/specContext.spec.ts
├── unit/spec-viewer/stateDerivation.spec.ts
└── integration/specContextWorkflows.spec.ts
```

**Structure Decision**: Single VS Code extension layout. New SpecContext schema lives in `src/core/types/`; reader/writer/backfill in `src/features/specs/`; viewer state derivation isolated in `src/features/spec-viewer/stateDerivation.ts` so the webview becomes a pure renderer of derived state. Prompt-side changes are localized to skill prompt files.

## Complexity Tracking

No constitutional violations to justify.
