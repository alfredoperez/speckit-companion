# Implementation Plan: Attach a hook from a list, not from memory

**Spec**: [spec.md](./spec.md) · **Size**: normal · **Research**: [research.md](./research.md) · **Data model**: [data-model.md](./data-model.md) · **Contracts**: [contracts/](./contracts/)

## Summary

The form that attaches work already has the shape this needs: the value field reacts to the kind, and switching kind already clears what was typed. Two things are missing. The command kind offers nothing at all, and the entries the other kinds do offer are bare strings with no way to tell what any of them is.

So this adds a catalog of installed commands to the data the panel already receives, widens the offered entries from names to entries carrying a description and a usual placement, and replaces the type-ahead with the panel's own menu so the descriptions are visible while choosing. Typing by hand stays exactly where it is, beside the list rather than instead of it.

The catalog is built where every other choice is built and travels in the same message. A second fetch would be a second source, and a second source drifts.

## Project Structure

```
speckit-extension/
  scripts/
    build-pipeline.py            # a new reader: every hook command the registries carry
    pipeline-graph.py            # puts it in `choices`, beside skills and nodes
  tests/
    test_builder_flow.py         # the catalog's contents, per project
src/
  protocol/pipeline.ts           # the offered-entry shape, and `choices.commands`
webview/src/pipeline-builder/
  AttachForm.tsx                 # the second selector reads the catalog
  __tests__/AttachForm.test.tsx  # the cascade, the clearing, the free-text fallback
  __stories__/Components.stories.tsx
```

**Structure Decision**: The catalog is one new function in `build-pipeline.py` beside `available_skills` and `available_hook_nodes`, because it is the same kind of question asked of a different registry, and `stock_hooks` already parses the file it needs. Nothing moves.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. The list is derived from the project's registries, so an extension installed tomorrow appears without a change here. A project with no registry gets a form that still works. |
| II. Spec-Driven Workflow | PASS. The panel could draw a pipeline it could not help you build; this closes that. |
| III. Visual and Interactive | PASS. This is the point of the change: the choice is visible and described rather than remembered and typed. |
| IV. Modular Architecture for Complex Features | PASS. One reader, one protocol field, one form change. No new module and no second source. |

No violations, so there is no Complexity Tracking table.
