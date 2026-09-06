# Implementation Plan: Reach one requirement, from anywhere

**Spec**: [spec.md](./spec.md) · **Size**: oversized · **Branch**: `609-living-spec-navigation`

## Scale note

This change spans four areas that share almost no code: the Python resolver and a new script under `speckit-extension/scripts/`, a command body and its registration under `speckit-extension/`, the VS Code extension's TypeScript model and a new status bar contribution, and the docs. About 16 files. The thing to watch is the one seam that crosses all of them: requirement headings are parsed twice, once in Python and once in TypeScript, and the two halves are pinned against shared fixtures. Every reader added here must go through those existing parsers, never a third regex.

## Summary

Wave 3 gives the requirement three new readers without changing anything on disk. A `living-show` command prints one slice of a capability's spec — its headings, one named requirement, or the requirements that describe a given file — by calling the resolver that already does the slicing for the load steps. A `rules:` block in `living-specs.yml` carries project-wide one-line guidance for the spec and plan steps, surfaced by the resolver so the command bodies read it the same way they read capabilities. A status bar item in the editor answers "which durable rules describe this file?" from the registry in-process, and its picker opens the matching requirement in the spec viewer. No new dependencies, no new storage, no format change.

## Project Structure

```
speckit-extension/
  commands/speckit.companion.living-show.md      NEW  the command body
  extension.yml                                        register the command
  scripts/
    resolve-spec-paths.py                              add `--headings`, `--requirement`, `--rules`
    companion_config.py (vendored copy under .specify) normalize the `rules:` block
  nodes/
    specify/load-living-specs.md                       read + inject spec rules
    plan/gather-context.md                             read + inject plan rules
src/features/specs/
  livingSpecsModel.ts                                  parse `rules`, add claimsForFile()
  livingSpecsStatusBar.ts                        NEW  the indicator + its picker
  livingSpecsCommands.ts                               register the picker command
src/features/spec-viewer/
  specViewerCommands.ts                                accept an optional requirement target
  messageHandlers.ts                                   post the scroll-to-requirement message
webview/src/spec-viewer/toc.ts                         honour an initial requirement target
package.json                                           the picker command contribution
docs/living-specs.md                                   the two-meanings paragraph + the flags
CHANGELOG.md, README.md                                user-facing notes
```

**Structure Decision**: Nothing new is introduced structurally. Each of the three features attaches to the file that already owns its concern — the resolver owns slicing, `companion_config.py` owns registry normalization, `livingSpecsModel.ts` owns the editor's view of the registry. The one new source file is the status bar item, which is genuinely new behaviour with its own lifecycle.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS — the rules block is optional configuration in the file that already configures living specs; absent means today's behaviour. |
| II. Spec-Driven Workflow | PASS — the wave is itself specced, and it strengthens the workflow by making the durable specs cheaper to read. |
| III. Visual and Interactive | PASS — the status bar item and its picker are the visual half; the terminal command serves the non-visual half. |
| IV. Modular Architecture for Complex Features | PASS — three independent slices, each landing in the module that already owns its concern, with the status bar as its own file rather than an addition to an existing one. |

No violations, so no Complexity Tracking table.

## Phase 0 — Research

See [research.md](./research.md).

## Phase 1 — Design

See [data-model.md](./data-model.md) and [contracts/](./contracts/).
