# Implementation Plan: Centralize Magic Strings

**Branch**: `037-centralize-magic-strings` | **Date**: 2026-04-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/037-centralize-magic-strings/spec.md`

## Summary

Centralize ~300+ scattered raw string literals into named constant objects in `src/core/constants.ts`. Six constant groups will be added or consolidated: WorkflowSteps, SpecStatuses, AIProviders, GlobalStateKeys, TreeItemContext (consolidation), and consistent CORE_DOCUMENTS usage. This is a pure refactor with zero behavioral changes.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`)
**Storage**: N/A (no data storage changes)
**Testing**: Jest with ts-jest, `npm test`
**Target Platform**: VS Code Extension Host (Node.js)
**Project Type**: Single VS Code extension
**Performance Goals**: N/A (compile-time refactor only)
**Constraints**: Must not change any runtime behavior; must pass compile + tests
**Scale/Scope**: ~88 TypeScript source files in src/, ~300+ string replacements

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Extensibility and Configuration | PASS | Constants improve extensibility — adding a new provider/step/status is a single-line change |
| II. Spec-Driven Workflow | PASS | Workflow step names and statuses are being centralized, not changed |
| III. Visual and Interactive | N/A | No UI changes |
| IV. Modular Architecture | PASS | Consolidating scattered definitions into one module improves modularity |
| AI Provider Integration | PASS | AIProviders constant backs the existing AIProviderType union |
| User Interface | N/A | No UI changes |

No violations. All gates pass.

## Project Structure

### Documentation (this feature)

```text
specs/037-centralize-magic-strings/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── core/
│   └── constants.ts              # PRIMARY: All new constant groups added here
├── ai-providers/
│   └── aiProvider.ts             # AIProviderType derived from AIProviders constant
├── features/
│   ├── steering/
│   │   └── treeContextValues.ts  # DELETED or converted to re-export from constants.ts
│   └── spec-viewer/
│       └── types.ts              # CORE_DOCUMENTS stays here; imported more widely
└── [~20 files updated]           # Raw strings replaced with constant references

tests/
└── [test files updated]          # Import constants instead of raw strings
```

**Structure Decision**: No new files created. `constants.ts` is extended in place. `treeContextValues.ts` is consolidated into `constants.ts` and either deleted (with import redirects) or converted to a re-export barrel.

## Complexity Tracking

No constitution violations to justify. This is a straightforward refactor.
