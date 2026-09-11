# Implementation Plan: Living spec surface

**Branch**: `611-living-spec-surface` | **Date**: 2026-09-10 | **Spec**: [living-spec-surface.spec.md](./living-spec-surface.spec.md)

## Summary

Opening a living capability already reaches the spec viewer in living mode, and that mode already wraps each requirement in a card, colours WHEN/THEN scenarios, and puts pips on the rail. LV-1 reshapes that path into the requirement surface rather than building a second renderer: the card gets a 3px state edge and a state word instead of badges, the header gets state counts, the rail pip takes the card's state colour, and the living footer states the capability's condition and offers Adopt an area, Validate, and Sync. Per-card drift is computed in the extension, where the drifted-file list and the glob matcher already live, and sent to the webview as a list of drifted headings. One watcher gap is closed so an open surface redraws when its capability file changes.

## Project Structure

```text
src/
├── protocol/viewer.ts                         # LivingHeaderMeta gains driftedRequirements; new livingValidate message
├── features/spec-viewer/specViewerProvider.ts # pushLivingHealth sends drifted headings
├── features/spec-viewer/messageHandlers.ts    # livingValidate handler
├── features/specs/livingSpecsModel.ts         # driftedRequirements(): slices × drifted files
├── features/specs/livingSpecsCommands.ts      # speckit.livingSpecs.validate command
└── extension.ts                               # capability-file watcher also refreshes an open viewer
webview/
├── src/spec-viewer/markdown/livingComponents.ts # card: state attr, state word, touches link, no badges
├── src/spec-viewer/toc.ts                       # pip colour from card state
├── src/spec-viewer/components/SpecHeader.tsx    # count line
├── src/spec-viewer/components/footer/LivingFooter.tsx # condition + Adopt / Validate / Sync, empty-state CTA
├── src/spec-viewer/index.tsx                    # apply drifted state to cards on livingHealthResolved
└── styles/spec-viewer/_living.css, _toc.css, tokens.css
```

**Structure Decision**: extend the existing living-mode files. Every concern already has an owning file, and the house rule prefers extending it over adding one. No new module.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. No provider-specific logic; Validate dispatches through the existing terminal path. |
| II. Spec-Driven Workflow | PASS. Living specs are part of the pipeline's record; no lifecycle change. |
| III. Visual and Interactive | PASS. The feature is the visual surface. |
| IV. Modular Architecture | PASS. Changes land in the existing provider, message-handler, renderer, and CSS partial modules. |
| User Interface | PASS. Stays inside the custom viewer, which already hosts living specs. |

Re-checked after design: no change.

## Capabilities

- **specs-living-view**: the card surface, header counts, rail pips, bar actions, Validate command, watcher refresh.
- **specs-living-model**: `driftedRequirements`, the per-requirement drift intersection.
