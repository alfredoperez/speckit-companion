# Plan: The canvas and the mod read the shared viewer core

## Summary

The canvas build replaces its step-history bundle with one `vendor/viewer-core.mjs`, bundled from `packages/viewer/src/core` subpaths and the contract with esbuild's `source` condition. The board takes task counting, the status order, the pipeline steps and the step status tables from it, keeps every rule where core behaves differently, and its Overview reads `deriveViewerState(ctx)` and `markMissingTests`. The mod's build gains the `source` condition so the shared module reaches it through the bundled board rules, and its Overview model reads the same derivation.

## Project Structure

```text
apps/copilot-canvas/
├── build.mjs                                   # viewer-core bundle replaces step-history
└── com.github.copilot/extensions/speckit-companion/
    ├── tasks.mjs        # countTaskCheckboxes from core; listTasks, phaseProgress stay
    ├── spec-rules.mjs   # PIPELINE_STEPS, statusRank, step tables from core
    ├── overview.mjs     # rows from deriveViewerState + markMissingTests
    └── vendor/          # regenerated
apps/copilot-canvas/tests/render.test.mjs        # concerns case
apps/claude-mod/build.mjs                        # conditions: ['source']
apps/claude-mod/hooks/board.js                   # overviewModel from deriveViewerState
apps/claude-mod/hooks/vendor/, tests/fixtures/   # regenerated
CLAUDE.md                                        # the share-no-code rule
```

**Structure Decision**: one bundled module with named subpath re-exports, so the canvas never pulls the whole core index (which carries the markdown renderer twice).

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: no setting changes. |
| II. Spec-Driven Workflow | PASS: the board reads the record the way the viewer does. |
| III. Visual and Interactive | PASS: same HTML; the board gains the concerns it missed. |
| IV. Modular Architecture | PASS: one shared core instead of three copies. |

## Key Decisions

- **Replace only exact matches.** Core's `deriveStepBadges`, `taskEntries` and `canonicalStatusLabel` behave differently (all seven steps, stripped titles, uppercase labels), so the board keeps its own. Rejected: a full swap, which changes badges and the `[P]` count.
- **The Overview reads the derivation, keeps its HTML.** Rendering with the viewer's components is the next PR.
- **The mod's failed-check flag follows the derivation**, which keeps exit codes only for run checks.
