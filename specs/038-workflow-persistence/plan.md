# Implementation Plan: Workflow Persistence Across Spec Lifecycle

**Branch**: `038-workflow-persistence` | **Date**: 2026-04-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/038-workflow-persistence/spec.md`

## Summary

The spec editor submits specs with a user-selected workflow but never persists the selection to `.spec-context.json`. Subsequent operations (viewer, step execution) fall back to the default workflow instead of honoring the original choice. The fix ensures workflow selection is saved at creation time and that a sensible default is applied when no explicit selection is made.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`)
**Storage**: `.spec-context.json` per spec directory (JSON, workspace `.claude/` tree)
**Testing**: Jest with `ts-jest`, VS Code mock at `tests/__mocks__/vscode.ts`
**Target Platform**: VS Code Desktop (macOS, Windows, Linux)
**Project Type**: Single VS Code extension (Node.js extension host + webview browser context)
**Performance Goals**: N/A — workflow persistence is file I/O on local disk, sub-millisecond
**Constraints**: Must not break existing `.spec-context.json` files; backward-compatible merge
**Scale/Scope**: ~4 files modified, ~30 lines of production code

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Extensibility and Configuration | PASS | Uses existing `saveFeatureWorkflow()` API; respects `speckit.defaultWorkflow` setting; no new coupling |
| II. Spec-Driven Workflow | PASS | Strengthens the pipeline — workflow selection now persists across the full Specify→Plan→Tasks→Implement cycle |
| III. Visual and Interactive | PASS | No UI changes needed; viewer already reads persisted workflow correctly |
| IV. Modular Architecture | PASS | Changes are scoped to existing modules; no new files needed |

No violations. No complexity justification needed.

## Project Structure

### Documentation (this feature)

```text
specs/038-workflow-persistence/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/features/
├── spec-editor/
│   └── specEditorProvider.ts    # FIX: call saveFeatureWorkflow() in handleSubmit()
├── spec-viewer/
│   └── specViewerProvider.ts    # VERIFY: resolveWorkflowSteps() handles missing workflow gracefully
├── specs/
│   └── specCommands.ts          # VERIFY: executeWorkflowStep() defers to persisted workflow
└── workflows/
    ├── workflowManager.ts       # VERIFY: saveFeatureWorkflow() and getFeatureWorkflow()
    └── workflowSelector.ts      # VERIFY: getOrSelectWorkflow() default fallback chain

tests/
└── src/features/
    ├── spec-editor/             # NEW: test workflow persistence on submit
    └── workflows/               # NEW: test default fallback behavior
```

**Structure Decision**: All changes fit within existing module boundaries. No new files or directories needed for production code.
