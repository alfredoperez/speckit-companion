# Implementation Plan: Reviewing a living spec

**Branch**: `612-living-spec-review` | **Date**: 2026-09-17 | **Spec**: [living-spec-review.spec.md](./living-spec-review.spec.md)

**Scale note**: about 22 files across both extensions: the viewer's extension side, the webview, the Living Specs commands, and two Python scripts in the spec-kit extension. Watch two seams. Every refresh rebuilds the webview page, so Undo state has to live in the extension. And the TypeScript and Python aligns parsers must keep agreeing, which the shared fixture set enforces.

## Summary

A reader can review a living spec without leaving the viewer. The bottom bar gains Approve all with a 5-second Undo, and Remove gains the same Undo. Cards mark requirements that `main` does not have, and list what they lean on and what leans on them. A command palette entry opens any capability at any requirement.

Most of the machinery exists. Approve, Remove, open-at-requirement, the slow-fact push and an unused `UndoToast` component are already in the codebase. This change connects them rather than building new layers. Undo is held on the panel in the extension, because the webview page is regenerated on every refresh and would lose it. Links are computed in-process from the existing requirement slicer. The New mark rides the post-paint health push, since it needs git. A removal that stands is appended to a `.spec-context.json` beside the capability's spec. The spec-kit extension's resolver and validator learn to read that record.

## Project Structure

```text
src/
├── protocol/viewer.ts                           # links on overview requirements, newRequirements on header meta, livingUndo on NavState, undoLivingAction message
├── features/spec-viewer/
│   ├── livingDocs.ts                            # appendLivingRemoval; delete the loose alignsIn
│   ├── messageHandlers.ts                       # snapshot before approve/remove, undo handler, refusal via shared aligners
│   ├── specViewerProvider.ts                    # pending undo on panel state, timer, settle on dispose and re-anchor, links in builder
│   ├── livingHeaderMeta.ts                      # resolveLivingHealth adds newRequirements
│   └── __tests__/                               # livingDocs, messageHandlers, livingHeaderMeta
└── features/specs/
    ├── livingSpecsModel.ts                      # requirementLinks, readMainCopy beside the git runner
    ├── livingSpecsCommands.ts                   # speckit.livingSpecs.open
    └── __tests__/                               # requirementSlices, livingSpecsCommands, manifest
webview/
├── src/spec-viewer/
│   ├── components/footer/LivingFooter.tsx       # Approve all N, UndoToast
│   ├── components/SpecHeader.tsx                # drop ApproveSpecButton, add "N new"
│   ├── markdown/livingComponents.ts             # data-req-new, New pill, Leans on / Leaned on by
│   ├── actions.ts                               # link click → openLivingSpec with requirement
│   ├── messageHandlers.ts                       # livingHealthResolved sets the new set
│   └── *.stories.tsx, __tests__/                # FooterActions, SpecHeader, LivingComponents
└── styles/spec-viewer/_living.css               # new edge on data-req-new, link lists, broken state
speckit-extension/
├── scripts/resolve-spec-paths.py                # --leaned-on-by, removed_requirements()
├── scripts/living_validate.py                   # skip delta-heading-not-found for recorded removals
└── tests/                                       # test_resolve_spec_paths, test_living_validate, fixtures/requirement-slices
package.json                                     # command contribution
docs/viewer-states.md, docs/sidebar.md, CHANGELOG.md, speckit-extension/CHANGELOG.md, docs/screenshots/generated/
```

**Structure Decision**: every change extends the file that already owns its concern. No new source module is added. `UndoToast` gets its first production use rather than a second undo component.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. No provider logic. The `main` comparison branch is fixed on purpose and listed as out of scope in the spec. |
| II. Spec-Driven Workflow | PASS. Living specs are the pipeline's long-lived output. Nothing changes a feature spec's lifecycle. |
| III. Visual and Interactive | PASS. Every story surfaces in the viewer. The resolver flag mirrors a visible fact for commands. |
| IV. Modular Architecture | PASS. The viewer already splits provider, handlers, protocol and rendering. Each change lands in the module that owns it. |
| AI Provider Integration | PASS. Not touched. |
| User Interface | PASS. The new command sits in the SpecKit category beside the existing Living Specs commands. |

Re-checked after Phase 1 design: no change.
