# Implementation Plan: Capability registrations get their own file

**Branch**: `405-capability-registry-file` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)
**Size**: oversized (28 projected files, 22 projected tasks)

## Summary

Living-spec capability registrations move out of `.specify/companion.yml` and into a new project-root file, `living-specs.yml`. The old file keeps its pipeline hook and recipe settings; only the `livingSpecs` block leaves it. One shared resolver in the Python config loader answers "where does this project keep its capabilities" for every script, and a matching resolver in the TypeScript reader answers it for the VS Code side, so there is exactly one rule and it cannot drift between the two halves. Readers prefer the new file and fall back to the old one, so nobody's existing registrations stop working. Writers always write the new file and, when they found the registrations in the old one, lift them out of it in the same operation and say so.

The new file uses the flattened shape a dedicated file deserves — `enabled`, `exempt`, and `capabilities` at the top level, with no wrapper key — while the loader still accepts a pasted `livingSpecs:` wrapper so a hand-migration cannot go wrong.

No new runtime modules are introduced: the location rule lives in the existing `companion_config.py`, so neither packing list (`package-manifest.py`, `.vscodeignore`) changes.

## Project Structure

```
living-specs.yml                                   # NEW — the capability registry (created on adoption)

speckit-extension/
  scripts/
    companion_config.py                            # owns the location rule + both file shapes
    register-capability.py                         # writes the registry; migrates on write
    relocate-capability.py                         # writes the registry; migrates on write
    resolve-spec-paths.py                          # reads via the shared rule; boundary probe
    drift.py                                       # reads via resolve-spec-paths (no change beyond prose)
    check-coverage.py                              # reads via resolve-spec-paths (no change beyond prose)
    living_spec_fold.py                            # reads via resolve-spec-paths (no change beyond prose)
  commands/
    speckit.companion.living-adopt.md              # prose: name the registry
    speckit.companion.living-move.md
    speckit.companion.living-drift.md
    speckit.companion.living-coverage.md
    speckit.companion.mark-complete.md
    speckit.companion.specify.md                   # assembled — re-blessed from the node
  nodes/specify/load-living-specs.md               # the gate prose that names the config path
  tests/
    test_living_specs.py                           # registry location, migration, restore-survival
    fixtures/living-specs.yml                      # NEW — registry-shaped fixture
  README.md
  CHANGELOG.md                                     # [Unreleased]

src/features/specs/
  livingSpecsModel.ts                              # registry-first read + boundary probe
  livingSpecsExplorerProvider.ts                   # empty-state copy names the registry
  __tests__/livingSpecsModel.test.ts
src/extension.ts                                   # watcher glob gains living-specs.yml

.claude/commands/{install-local,fix-tickets,ship-ticket}.md   # note that the cleanup no longer risks registrations
speckit-extension/examples/ship-ticket/nodes/install-local.md
README.md, CHANGELOG.md                            # VS Code half (livingSpecsModel.ts changed)
```

**Structure Decision**: the location rule is added to the two files that already own config reading — `companion_config.py` on the CLI side and `livingSpecsModel.ts` on the editor side. Every other reader already goes through one of those two, so no third opinion about where the registry lives can appear.

## Constitution Check

No `.specify/memory/constitution.md` in this project, so the repository's own conventions in `CLAUDE.md` and `.claude/review-checklist.md` stand in for it.

| Principle | Assessment |
|---|---|
| Extension isolation — shipped code must not read `.claude/**` or `.specify/**` fixtures | PASS. The new file is at the project root, read by shipped extension code and shipped scripts only. Nothing new is read from `.claude/`. |
| Two extensions, two sets of docs | PASS. `speckit-extension/README.md` + its `[Unreleased]` changelog for the script half; root `README.md`/`CHANGELOG.md` for the editor half, which genuinely changes (`livingSpecsModel.ts`). No version bumps anywhere. |
| One fact, one derivation | PASS. Exactly two resolvers, one per language runtime, each the single answer for its side. No consumer re-derives the path. |
| A probe answering "is this X?" must distinguish no from could-not-tell | PASS. The nested-project boundary probe keeps its existing rule — only a confirmed absence means "not a project" — and now applies it across both candidate files. |
| A writer mutating a multi-block config splices only its own block | PASS. Removing the block from the old file reuses the existing splice, which preserves sibling blocks and inter-block comments. The new file is spliced the same way. |
| A new gate needs a test proving it fails | PASS. Each new test is drift-proofed by reverting the behavior it guards and confirming the failure. |
| Markdown: no hard-wrapped paragraphs | PASS. |
| Code comments: default to none | PASS. |

No violations, so no Complexity Tracking table.

## Phase 0 — Research

See [research.md](./research.md).

## Phase 1 — Design

See [data-model.md](./data-model.md) and [contracts/](./contracts/).
