# Implementation Plan: Spec Explorer Sidebar View

**Branch**: `381-spec-explorer` | **Date**: 2026-06-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/381-spec-explorer/spec.md`

## Summary

Add a new `Spec Explorer` tree view to the SpecKit activity-bar container that lists the project's living specs — capabilities (with their tiers) and orphan `*.spec.md` files — and opens any of them on click. A new `LivingSpecsExplorerProvider extends BaseTreeDataProvider` renders the tree; a small node-side model (`livingSpecsModel.ts`) reads the `livingSpecs` block from `.specify/companion.yml` with the already-bundled `js-yaml`, resolves each capability's spec path and its architecture/coverage tier siblings, and globs the tree for orphans — re-implementing the resolver's listing rules in TypeScript so the view needs no Python at runtime. The view is gated in `package.json` on the existing `speckit.companion.installed` context key composed with the workspace-non-empty guard, and refreshed by a `FileSystemWatcher` on the companion config and the `capabilities/` tree.

## Project Structure

```
src/
├── extension.ts                                  # register provider + tree view + watcher (edit)
├── core/
│   └── constants.ts                              # add Views.livingSpecs id (edit)
└── features/
    └── specs/
        ├── livingSpecsModel.ts                   # NEW — node-side reader: parse companion.yml, resolve caps/tiers/orphans
        ├── livingSpecsExplorerProvider.ts        # NEW — TreeDataProvider for the view
        ├── index.ts                              # re-export the new provider (edit)
        └── __tests__/
            └── livingSpecsModel.test.ts          # NEW — unit tests for the node-side reader

package.json                                      # NEW view contribution + when-clause + viewsWelcome empty state (edit)
docs/sidebar.md                                   # NEW section documenting the view (edit)
README.md                                         # "Sidebar at a Glance" summary (edit)
```

**Structure Decision**: Follow the existing sidebar-provider pattern (`specExplorerProvider.ts`, `steeringExplorerProvider.ts`) — a provider class extending `BaseTreeDataProvider` plus a `*Item extends vscode.TreeItem`. The data rules live in a separate pure module (`livingSpecsModel.ts`) so they can be unit-tested without a `vscode` host, since the provider itself reads live `vscode.workspace` config and is review-only per the known config-mock gap.

## Constitution Check

| Principle | Assessment |
|-----------|------------|
| I. Extensibility and Configuration | PASS — reads the existing `livingSpecs` config contract; no new provider-coupling. |
| II. Spec-Driven Workflow | PASS — read-only index of living specs; no lifecycle status changes, preserves the managed model. |
| III. Visual and Interactive | PASS — a native tree view with click-to-open and a friendly empty state. |
| IV. Modular Architecture for Complex Features | PASS — data rules in a pure module, rendering in the provider, registration in `extension.ts`. |

No violations — Complexity Tracking omitted.

## Key Decisions

See [research.md](./research.md). In short: node-side TypeScript reader (no Python dependency on the hot path), mirror the resolver's listing rules exactly, gate visibility on the existing `speckit.companion.installed` key, and open files directly rather than routing through the rich spec viewer.

## Phase 0 — Research

See [research.md](./research.md).

## Phase 1 — Design

See [data-model.md](./data-model.md). No external interface/contract is exposed (the view is internal UI), so `contracts/` is omitted.
