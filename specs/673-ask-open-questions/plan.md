# Plan: Ask a spec's open questions before plan

## Summary

The default specify self-check gains the question table the blocking variant already has, but only when open-question markers remain, so a clean spec runs as today. Both checklist nodes gain one unattended branch: when the run is unattended, each question gets a default under Assumptions and one recorded concern instead of a pause. The spec draft (and its bugfix variant) gains Non-goals, Change-level rules and Verification plan sections, and finalize records the Non-goals section as the spec's non-goals. All of it is instruction text in node files; the built specify command is regenerated, and the docs and changelog follow.

## Project Structure

```text
apps/speckit-extension/
├── nodes/specify/
│   ├── quality-checklist.md            # ask when markers remain; unattended branch
│   ├── quality-checklist-blocking.md   # unattended branch; drop the stale "advisory defers to clarify" line
│   ├── draft-spec.md                   # three new sections; "None" allowed
│   ├── draft-spec-bugfix.md            # Non-goals and Verification plan for bug specs
│   └── finalize.md                     # non-goals come from the Non-goals section; drop "four sections"
├── commands/speckit.companion.specify.md  # rebuilt by scripts/build.py
└── CHANGELOG.md                        # one [Unreleased] line
apps/website/src/content/docs/docs/steps/index.mdx  # Specify and Auto sections
```

**Structure Decision**: change the default node rather than swapping in the blocking variant, because the variant re-runs a whole checklist loop and writes a checklist file; the issue asks only that the open questions get asked.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: the blocking variant stays a pick; recipes that replace the node keep their own behavior. |
| II. Spec-Driven Workflow | PASS: strengthens it; plan starts from a spec with no open questions. |
| III. Visual and Interactive | PASS: no UI change. |
| IV. Modular Architecture | PASS: changes live in the nodes that own the behavior; no script change. |

Re-checked after design: unchanged.

## Key risks

- The instruction budget: specify is the heaviest command (47 directives, strict cap 69). Table and command examples go in fences, which do not count.
- The unattended flag is read from the dispatched prompt or the run record, because auto passes it both ways.
