# Implementation Plan: A living spec is read one requirement at a time

**Spec**: [spec.md](./spec.md) · **Issue**: [#672](https://github.com/alfredoperez/speckit-companion/issues/672) (Wave 1 of 3) · **Branch**: `605-requirement-level-living-specs` · **Size**: normal

## Summary

A requirement gains one optional line naming the files it describes, written as an HTML comment so every existing reader ignores it. Two commands that already produce requirements — adoption and sync — write that line as a by-product of the work they already do. The load step in specify and plan then contributes a capability's purpose, the requirements whose marker matches a changed file, and every unmarked requirement, instead of the whole file. The viewer derives an outline of requirement headings from the pass that already builds requirement cards, so a reader can reach any requirement in one action.

Nothing new appears on disk beyond the marker, and nothing already on disk changes shape. The whole feature is additive in both directions: a spec with no markers loads exactly as it does today, and a spec with markers is read identically by fold-back, drift, sync, coverage and the viewer's cards.

The one structural risk is divergence. Requirement slicing has to exist twice — TypeScript for the viewer and the extension, Python for the command bodies — because neither runtime can call the other. Research settles that as forced, and the plan pins both against one shared fixture set, which is the mechanism `core.spec.md` already prescribes for a fact that has to be true in two runtimes.

## Project Structure

```
src/features/specs/
  livingSpecsModel.ts          # requirementSlices() beside requirementIds(); marker parse; glob reuse
  __tests__/livingSpecsModel.test.ts

webview/src/spec-viewer/
  markdown/livingComponents.ts # outline derived in the requirement-card pass
  components/                  # the outline's rendering + its story
webview/styles/spec-viewer/
  _living.css                  # outline styling, sticky beside the cards

speckit-extension/
  scripts/resolve-spec-paths.py  # requirement slicing + --requirements-for
  nodes/specify/load-living-specs.md   # selective load instruction
  nodes/plan/gather-context.md         # the same, on the plan side
  commands/speckit.companion.living-adopt.md   # write markers on produced requirements
  commands/speckit.companion.living-sync.md    # write/widen markers on updated ones
  tests/fixtures/requirement-slices/   # the shared fixture set both suites read
  tests/test_resolve_spec_paths.py
  tests/golden/commands/               # re-frozen after the node edits
```

**Structure Decision**: the work lands in the three places that already own these concerns — the extension's living-spec model, the webview's living renderer, and the spec-kit resolver — plus the two command bodies that produce requirements. No new module is introduced on either side; the parser sits next to `requirementIds()` because that is the existing authority on what counts as a requirement, and the outline sits inside `preprocessLivingRequirements` because that pass already walks every heading. The one genuinely new artifact is the shared fixture directory, which exists precisely because two runtimes must agree.

## Key Decisions

Full reasoning in [research.md](./research.md). The load-bearing ones:

- The marker is an HTML comment under the heading, matching the `<!-- capability: … -->` convention fold-back already uses, so no renderer or parser here reacts to it.
- Marker globs reuse each side's existing registry matcher rather than a second dialect.
- An unmarked requirement is loaded by every load. A marker can only narrow, never starve — that is the safety property that makes partial adoption possible.
- The outline is derived in the card-building pass and reads the same heading-keyed coverage store the badges use, so a row and its card cannot disagree.

## Constitution Check

| Principle | Assessment |
| --- | --- |
| I. Extensibility and Configuration | **PASS** — the marker is optional and additive; a project that never writes one is unaffected, and no new setting is introduced. The registry stays the only place capabilities are configured. |
| II. Spec-Driven Workflow | **PASS** — no step, status or transition is added or renamed. The load step reads less; what it records grows by one additive field alongside the existing one. |
| III. Visual and Interactive | **PASS** — the outline is the visible half of the feature, derived from what the renderer already parses, and it is reachable by keyboard as well as pointer. |
| IV. Modular Architecture | **PASS** — no module grows a second responsibility: parsing joins the model that already parses, the outline joins the pass that already walks headings, slicing joins the resolver that already reads specs. |

No violations, so there is no Complexity Tracking table.

## Phases

- **Phase 0 — Research**: [research.md](./research.md). Settles the marker's form, the glob semantics, why two parsers are forced and how they are pinned together.
- **Phase 1 — Design**: [data-model.md](./data-model.md) for the marker and the loaded-requirement record; [contracts/](./contracts/) for the identifiers the two parsers and the outline code against.
- **Phase 2 — Implementation**: task list generated by the next step.

## Risks

- **Two parsers drifting.** The mitigation is the shared fixture set, and it only works if both suites actually read it. A task asserts that a fixture added to the directory is exercised by both, so a fixture that only one side reads fails rather than silently covering half the feature.
- **Golden drift.** Editing two node bodies changes every assembled command body, so `check-shape-parity` fails until the captures are re-frozen. That regeneration is a task, not a surprise.
- **A marker that is too narrow.** By design this costs a run one unread requirement rather than a wrong one, and the unmarked-always-loads rule bounds it. Wave 2's validator is what will report a marker matching nothing; this wave deliberately does not.
- **Measuring SC-001.** The 60% claim needs a real before/after on the largest capability. That measurement is a task, and if it comes in materially under, the honest outcome is to say so on the issue rather than restate the target.
