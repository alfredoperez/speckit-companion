# Implementation Plan: Spec Explorer actions — drift, coverage, adopt

**Feature**: 384-explorer-actions · **Spec**: [spec.md](./spec.md) · **Source issue**: [#393](https://github.com/alfredoperez/speckit-companion/issues/393)

## Summary

Make the Spec Explorer actionable: right-click a capability to dispatch the existing drift/coverage commands to the AI provider (scoped to that capability), offer adopt from the view's title menu, and show per-capability health (covered/total requirements, a drift dot) computed natively by the extension. Dispatch reuses the provider-agnostic `executeSlashCommand` path every other Companion command uses; health extends the TS living-specs reader (`livingSpecsModel.ts`) with a coverage counter and a git-based drift check, both best-effort so the tree never breaks or blocks.

## Project Structure

```
src/features/specs/
├── livingSpecsExplorerProvider.ts   # health on rows (description/tooltip/color), refresh, async children
├── livingSpecsModel.ts              # + readCapabilityHealth(): coverage count (fs) + drifted (git), best-effort
├── livingSpecsCommands.ts           # NEW — registers the 4 commands (drift/coverage/adopt/refresh) → executeSlashCommand
└── __tests__/
    ├── livingSpecsModel.test.ts     # + health computation cases (covered/total, drift, failure fallbacks)
    └── livingSpecsCommands.test.ts  # NEW — registration + dispatch wiring
src/extension.ts                     # wire livingSpecsCommands registration
package.json                         # contributes.commands + menus (view/title + view/item/context)
docs/sidebar.md                      # Spec Explorer section: actions + health
README.md                            # sidebar-at-a-glance mention
```

**Structure Decision**: commands live in a new `livingSpecsCommands.ts` beside the provider (mirrors how spec commands pair with their provider) rather than growing `specCommands.ts`, which is spec-lifecycle-focused.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | **PASS** — provider-agnostic dispatch via the existing `AIProvider` interface; no provider-specific logic; actions appear only when the companion extension is installed. |
| II. Spec-Driven Workflow | **PASS** — no lifecycle changes; adds read-only health + dispatch conveniences around living specs. |
| III. Visual and Interactive | **PASS** — this feature exists to give CLI-only workflows a visual, interactive surface. |
| IV. Modular Architecture | **PASS** — new commands module beside the provider; health logic in the model; no webview. |

No violations. (Re-checked after Phase 1 design: still PASS.)

## Key risks

- **Drift needs git**: subprocess call must be async, time-bounded, and failure-silent (no git / not a repo → no indicator), or the tree hangs.
- **Menu gating**: actions must respect `speckit.companion.installed` and the capability `contextValue`s already emitted by the provider (`living-specs-capability`, `living-specs-capability-missing`).
- **Isolation rule**: the extension never runs workspace Python — health is computed in TS, mirroring (not shelling to) `check-coverage.py`/`drift.py`.
