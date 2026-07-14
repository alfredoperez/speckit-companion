# Implementation Plan: Open a spec from its name in the Specs tree

**Branch**: `397-open-spec-overview` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/397-open-spec-overview/spec.md`

## Summary

The spec-name row in the Specs tree is built with no command, so clicking it only toggles the row. This adds a spec-level open command, `speckit.openSpec`, that takes the spec's directory and hands it to the spec viewer provider. The provider opens (or reveals and re-renders) the panel for that spec and lets its existing landing rule decide what to show — the Overview when the spec has durable context, the first available document otherwise. Nothing about that decision is re-derived in the tree.

The landing rule already works out of the box for this path. The webview's `showingOverview` signal starts from an unset `viewerMode` and falls back to `hasDurableContext(...)`, and every extension-driven open re-generates the panel HTML, which reloads the webview and resets `viewerMode`. So an extension-side "open this spec" that goes through `updateContent` lands on the Overview when there is one and on a document when there is not — with no new message, no new flag, and no second copy of the rule. The "which document" half is likewise already owned by `resolveDisplayDocument`, whose cascade ends at the first existing core document and then the first openable one.

## Project Structure

```
src/features/specs/
  specExplorerProvider.ts          # spec row gains an open command
src/features/spec-viewer/
  specViewerCommands.ts            # registers speckit.openSpec
  specViewerProvider.ts            # new showSpec(specDirectory) entry point
src/features/specs/__tests__/
  specExplorerProvider.test.ts     # spec row carries the open command
src/features/spec-viewer/__tests__/
  showSpec.test.ts                 # open/reveal + landing fallback + no-documents
docs/sidebar.md                    # click behavior reference
docs/viewer-states.md              # landing view on a spec-level open
README.md                          # "Sidebar at a Glance"
CHANGELOG.md                       # user-facing entry
```

**Structure Decision**: The change lives entirely in the existing tree provider and spec-viewer provider; no new module, no new message type, no new setting.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS — no new setting; the behavior is a plain default, and no existing configuration key changes. |
| II. Spec-Driven Workflow | PASS — opening a spec is read-only; no lifecycle state is written. |
| III. Visual and Interactive | PASS — makes the most obvious click target do the obvious thing; the viewer's own visuals are untouched. |
| IV. Modular Architecture | PASS — the tree gains a command reference, the viewer gains one public entry point; the landing rule stays where it already lives. |

No violations, so no Complexity Tracking table.

## Phase 0 — Research

See [research.md](./research.md).

## Phase 1 — Design & contracts

The feature introduces no entities or persisted data, so there is no `data-model.md`. It does expose one new interface — a command and a provider entry point — recorded in [contracts/open-spec-command.md](./contracts/open-spec-command.md).

Re-checked the Constitution table against the final design: unchanged, all PASS.
