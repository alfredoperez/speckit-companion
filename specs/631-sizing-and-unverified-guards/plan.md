# Implementation Plan: Sizing and unverified guards

**Branch**: `631-sizing-and-unverified-guards` | **Date**: 2026-10-08 | **Spec**: [sizing-and-unverified-guards.spec.md](./sizing-and-unverified-guards.spec.md)

## Summary

Three small changes in three places. The shared size definition gains one condition: a change that is hard to undo or hard to check is never small, so it never takes the short path. The one script that marks a spec complete adds a "finished, unverified" concern and prints a warning when the record holds no verification and no concern, and still completes. The sidebar row tooltip gains a Branch line, read through one helper the viewer also uses so the two never disagree. No new dependency, no new file type, no version bump.

## Project Structure

```text
apps/speckit-extension/
  presets/_parts/sizing.md                    the small bar gains "easy to undo and easy to check"
  nodes/specify/classify-size.md              the verdict rule and the reason line
  commands/speckit.companion.specify.md       rebuilt by build.py
  commands/speckit.companion.classify.md      rebuilt by build.py
  scripts/write-context.py                    mark_spec_complete adds the concern and the warning
  tests/test_context.py                       MarkCompleteTests cases
  docs/commands.md                            the sizing bar sentence
  CHANGELOG.md                                two entries under Unreleased
apps/vscode/src/features/specs/
  specBranch.ts                               new: resolveSpecBranch
  __tests__/specBranch.test.ts                new
  specExplorerProvider.ts                     the Branch tooltip line
  __tests__/specExplorerProvider.test.ts      tooltip cases
apps/vscode/src/features/spec-viewer/specViewerProvider.ts   both branch reads go through the helper
apps/website/src/content/docs/docs/steps/specify.mdx          how it sizes the change
apps/website/src/content/docs/docs/start/your-first-spec.mdx  the small-change sentence
apps/website/src/content/docs/docs/navigate/the-sidebar.mdx   the tooltip
CHANGELOG.md                                  one entry under Unreleased
```

**Structure Decision**: each change lands in the file that already owns the behaviour. The only new source file is the branch resolver, beside the assistant and status resolvers it copies.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. No setting added; the sizing rule lives in the shared part every command reads. |
| II. Spec-Driven Workflow | PASS. The pipeline keeps its steps; a risky small change gets more of them, never fewer. |
| III. Visual and Interactive | PASS. One tooltip line; the Overview already shows concerns. |
| IV. Modular Architecture for Complex Features | PASS. One small resolver module with its own test, the existing shape. |
| AI Provider Integration | PASS. Untouched. |
| User Interface | PASS. No layout change. |

No violations.

## Phase 0: Research

See [research.md](./research.md).

## Phase 1: Design

- [data-model.md](./data-model.md): the concern entry, the verdict inputs, the branch resolution order.
- [contracts/behaviour.md](./contracts/behaviour.md): the exact lines printed and written.
