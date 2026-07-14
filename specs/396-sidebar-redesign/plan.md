# Implementation Plan: Sidebar Redesign — One Coherent, VS Code-Native Sidebar

**Branch**: `396-sidebar-redesign` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)
**Size**: `oversized` (full pipeline)

## Summary

The sidebar's four TreeViews each drifted their own way: names overlap, decorative SVGs from an emoji-style set sit next to Codicons and brand logos at 16 px, the Specs title bar can carry six icon-only buttons, hover and right-click menus disagree, and every active spec opens pre-expanded. This plan corrects presentation only — the contributed titles, the icons the tree items carry, the default `collapsibleState` of a spec row, the composition of the title toolbar, and the shape of the Steering root — while leaving every command id, view id, setting key, lifecycle rule, filter, sort, multi-select, and Resume gate byte-identical.

The work lands in the existing extension surfaces: `package.json` contributions (view titles, command titles, menus), the three tree providers (`specExplorerProvider.ts`, `livingSpecsExplorerProvider.ts`, `steeringExplorerProvider.ts`, plus `overviewProvider.ts`), and `specCommands.ts` for the new More Actions picker and the filter's clear-on-empty behavior. Two pieces of logic that today live inline inside tree-item constructors get lifted into pure, testable modules — the provider-icon resolver and a friendly-status formatter — because both are correctness bugs (wrong brand, raw enum in a tooltip) that only tests can hold down.

Phase 1 of the design plan is the safety net and lands first: a manifest test that parses `package.json` and asserts the contributed shape (view titles, title-bar action ceiling, menu grouping, reveal eligibility, lifecycle `when` clauses), plus tree-presentation tests. Everything after it is changed against that net.

## Project Structure

```
package.json                                        # view titles, command titles, menus, submenu
src/
├── core/constants.ts                               # TreeItemContext additions (companion config item), Commands
├── features/
│   ├── specs/
│   │   ├── specExplorerProvider.ts                  # collapsed rows, Codicon groups, doc icons, tooltips
│   │   ├── livingSpecsExplorerProvider.ts           # copy, orphan reveal contextValue already present
│   │   ├── specCommands.ts                          # More Actions picker, filter clear-on-empty, sort copy
│   │   ├── specStatusLabel.ts                       # NEW — friendly status formatter (pure)
│   │   └── __tests__/
│   │       ├── manifest.test.ts                     # NEW — contribution lock
│   │       ├── specExplorerProvider.test.ts         # extended: collapse defaults, icons, tooltips
│   │       ├── specStatusLabel.test.ts              # NEW
│   │       └── livingSpecsExplorerProvider.test.ts  # NEW — empty/disabled/orphan rows
│   ├── steering/
│   │   ├── steeringExplorerProvider.ts              # explicit root order, nested create actions, Codicons
│   │   ├── providerIcon.ts                          # NEW — pure provider-icon resolver
│   │   └── __tests__/
│   │       ├── providerIcon.test.ts                 # NEW
│   │       └── steeringExplorerProvider.test.ts     # NEW — root order, nesting, tooltips
│   └── settings/overviewProvider.ts                 # unchanged rows, view retitled in manifest
assets/icons/
├── moss.svg, seedling.svg                           # kept (identity)
├── providers/*                                      # kept (official marks)
├── specs/*                                          # removed — replaced by Codicons
└── steering/*                                       # removed — replaced by Codicons
docs/sidebar.md, README.md, CHANGELOG.md, NOTICE.md  # phase 9
```

**Structure Decision**: No new module layout. Two pure modules are extracted from tree-item constructors (`providerIcon.ts`, `specStatusLabel.ts`) so the two correctness bugs they fix become testable; everything else edits in place.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | **PASS** — no provider logic changes; the new provider-icon resolver is a table keyed off the existing `AIProviders` union, so adding a provider stays a one-line addition. No setting is added, removed, or renamed. |
| II. Spec-Driven Workflow | **PASS** — lifecycle rules, statuses, transitions, and the Active → Completed → Archived model are untouched. Status transitions remain explicit user actions; the tree only changes how it *renders* them. |
| III. Visual and Interactive | **PASS** — this principle is the point of the change. Rendering stays native VS Code TreeView; no webview, no custom CSS. |
| IV. Modular Architecture for Complex Features | **PASS** — the two extracted pure modules reduce the size of the tree-item constructors rather than growing them. |

No violations. Complexity Tracking omitted.

## Phase 0 — Research

See [research.md](./research.md).

## Phase 1 — Design

- [data-model.md](./data-model.md) — the tree-item shapes and the icon/status mappings this feature reshapes.
- [contracts/sidebar-contributions.md](./contracts/sidebar-contributions.md) — the contributed manifest surface the manifest test asserts, carrying every Verbatim Constraint from the spec.
