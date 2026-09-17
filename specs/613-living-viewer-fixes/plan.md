# Implementation Plan: Living Viewer Fixes

**Branch**: `613-living-viewer-fixes` | **Date**: 2026-09-17 | **Spec**: [living-viewer-fixes.spec.md](./living-viewer-fixes.spec.md)

> **Scale note**: about 22 files across four areas: the approve path on the extension side, the viewer's markdown pipeline and rail, the sidebar tree, and the Overview card. The areas share only one new file, the naming util, so each can be built and reviewed alone. Watch the generated screenshots: every CSS change here makes them stale.

## Summary

Issue #747 lists two bugs and five design corrections in the living spec viewer. Both bugs are one-condition fixes where every caller already passes through: approve stops returning early before it reaches the banner, and the comment preprocessor learns three more marker names so they stop becoming a disclosure that pushes the banner out of its ten-line window. The design work is CSS for the card buttons and the rail, a grouping and label rule inside the tree model, and a regrouped Overview card. One new shared file holds the naming rule so the tree and the card cannot disagree.

## Project Structure

```text
src/core/utils/
└── capabilityNames.ts                      # NEW: readableName, stripSharedLeadingWords
src/core/utils/__tests__/
└── capabilityNames.test.ts                 # NEW
src/features/spec-viewer/
├── livingDocs.ts                           # approveLivingText drops the banner on whole-spec approve
└── __tests__/livingDocs.test.ts
src/features/specs/
├── livingSpecsModel.ts                     # capabilityGroupSegments, leaf and group labels
├── livingSpecsExplorerProvider.ts          # labels from the model, no healthy icon
└── __tests__/livingSpecsTree.test.ts, livingSpecsExplorerProvider.test.ts
webview/src/spec-viewer/
├── components/footer/LivingFooter.tsx      # Approve spec on any draft
├── components/__tests__/FooterActions.test.tsx, ../FooterActions.stories.tsx
├── markdown/preprocessors.ts               # pass reviewed, aligns, capability through
├── markdown/renderer.ts                    # drop those marker lines
├── markdown/livingComponents.test.ts
├── toc.ts                                  # dot only for adopted, drifted, new
├── __tests__/tocRequirements.test.ts
├── components/cards/LivingSpecsCard.tsx    # two groups, readable names
└── components/cards/__tests__/LivingSpecsCard.test.tsx, ../LivingSpecsCard.stories.tsx
webview/styles/spec-viewer/
├── _living.css                             # button metrics, Remove neutral at rest
├── _toc.css                                # cancel the h3 guide on requirement rows, drop the ring
└── _activity.css                           # group label, no synced stamp
docs/viewer-states.md, docs/sidebar.md, CHANGELOG.md, README.md (if it names the card)
docs/screenshots/generated/                 # regenerated, never hand-edited
```

**Structure Decision**: extend the file that already owns each concern. The only new source file is `src/core/utils/capabilityNames.ts`, because `src/core/` is the one place both the extension and the webview already import from.

## Capability map

Each decision names the living spec it folds back into.

| Decision | Capability |
|---|---|
| Whole-spec approve drops the banner | spec-viewer-living |
| Bar offers Approve spec on any draft | viewer-ui-chrome |
| Three more markers pass through and are skipped | viewer-ui-document |
| Button metrics, Remove neutral at rest | viewer-ui-document |
| Rail dots and guide | viewer-ui-navigation |
| Folder grouping, shared-prefix strip, no healthy icon | specs-living-model (grouping), specs-living-view (rows) |
| Overview groups and names | viewer-ui-overview |

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. No provider logic, no new setting. |
| II. Spec-Driven Workflow | PASS. Approve stays an explicit user action. |
| III. Visual and Interactive | PASS. Every change is in the GUI. |
| IV. Modular Architecture | PASS. One small util added, no file grows a second responsibility. |

Re-checked after Phase 1: unchanged.
