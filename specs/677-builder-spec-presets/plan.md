# Plan: Spec Kit presets in the Workflow Builder

> **Scale note**: about 14 files across the host (reader, panel messages, terminal) and the webview (one panel used in two views). The seam is one new message, `specPresets`, posted beside the existing `stock` and `graph` messages; the graph comes from a Python script, so presets cannot ride inside it.

## Summary

A new host module reads each `.specify/presets/<id>/preset.yml` and the `.registry`, and marks clashes against the commands Companion hooks (read live from `.specify/extensions.yml`) and the stock templates. The Builder posts the result as `specPresets` and handles four new messages that run `specify preset` verbs in a visible terminal after a modal confirm. One `PresetsPanel` webview component shows the list: a side pane opened from the Header menu in Companion projects, and in place of the stock board's preset list.

## Project Structure

```text
apps/vscode/src/
├── protocol/pipeline.ts                          # SpecPreset type, specPresets + four action messages
├── features/pipeline-builder/specPresets.ts      # new: readSpecPresets, companionReliesOn
├── features/pipeline-builder/stockWorkflow.ts    # export the stock template names; presets() delegates
├── features/pipeline-builder/builderPanel.ts     # watch .registry, post specPresets, four handlers
├── speckit/processExtensions.ts                  # runSpecifyPreset(verb, arg)
└── features/pipeline-builder/__tests__/specPresets.test.ts
apps/vscode/webview/src/pipeline-builder/
├── PresetsPanel.tsx                              # new, shared by both views
├── index.tsx, Header.tsx, StockBoard.tsx         # wire it in
├── __tests__/PresetsPanel.test.tsx, StockBoard.test.tsx
└── __stories__/PipelineBuilder.stories.tsx, fixtures.ts
apps/website/src/content/docs/docs/customize/workflow-builder.mdx
CHANGELOG.md
```

**Structure Decision**: a separate `specPresets` message rather than a graph field, because the graph is produced by `pipeline-graph.py`.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: shows what presets change; writes nothing itself. |
| II. Spec-Driven Workflow | PASS. |
| III. Visual and Interactive | PASS: one panel from existing Builder styles. |
| IV. Modular Architecture | PASS: host reads, webview renders, CLI writes. |

## Key Decisions

- **Clashes read live from `extensions.yml`** hooks whose command starts with `speckit.companion.` (the review checklist's prefix rule), plus the six stock templates. Rejected: a fixed list that drifts.
- **Warn, never block**: the modal confirm names the clash and still offers the action.
- **Ids validated** against `^[a-z0-9][a-z0-9-]*$` before any terminal command.
