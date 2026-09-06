# Implementation Plan: Living specs — trust the fold

**Spec**: [spec.md](./spec.md) · **Size**: oversized · **Research**: [research.md](./research.md) · **Data model**: [data-model.md](./data-model.md) · **Contracts**: [contracts/](./contracts/)

## Scale note

This change spans both halves of the repository and about twenty files. The shape check exists twice — once in Python for the command line and the fold, once in TypeScript for the editor — because neither runtime can call the other and the shipped extension cannot assume the scripts are installed. That duplication is the thing to watch: the two implementations are held to one shared set of example specs, with a guard that fails the build when only one of them reads an example. Everything else is additive. A project that adopts none of this sees no behaviour change at all.

## Summary

A living spec's shape is checkable but nothing checks it, so a broken requirement or a delta pointing at a heading that does not exist lands silently and is found much later by a person reading the file. This adds a read-only shape check that reports six kinds of finding with a file, a line, a severity, and a one-line fix, and then wires it into the two moments where it pays: the fold refuses to write a capability whose delta carries an error, and the editor publishes the same findings against a spec file when it is saved. A fold that would leave a capability with no requirements at all is refused separately, unless the registry says that capability is being retired.

The check parses the same requirement and scenario headings every other reader already counts, so it introduces no new dialect. It always exits successfully, because a report that can fail the shell it runs in is a gate wearing a report's clothes.

## Project Structure

```
living-specs.yml                                       # gains an optional per-capability `retire` key
speckit-extension/
  scripts/
    living_validate.py                                 # NEW — the checks, the findings, the CLI
    living_spec_fold.py                                # runs the check first; refuses on error; retire guard
    resolve-spec-paths.py                              # unchanged; the registry reader the check calls
  commands/
    speckit.companion.living-validate.md               # NEW — the command body
  extension.yml                                        # registers the new command
  tests/
    fixtures/spec-shape/                               # NEW — the shared examples, read by both runtimes
    test_living_validate.py                            # NEW
    test_living_specs.py                               # fold refusal + retire guard cases
src/
  features/specs/
    livingSpecsModel.ts                                # gains `retire` on the parsed capability
    specShapeCheck.ts                                  # NEW — the TypeScript twin of the checks
    specShapeDiagnostics.ts                            # NEW — save listener + diagnostic collection
    __tests__/specShapeCheck.test.ts                   # NEW — reads the same fixtures
  extension.ts                                         # registers the diagnostics listener
```

**Structure Decision**: The checks live in one new module per runtime and nothing else moves. `living_validate.py` is a module the fold imports rather than a script the fold shells out to, so the refusal path costs no subprocess and cannot be defeated by a missing interpreter. On the editor side `specShapeCheck.ts` is pure text-in, findings-out with no VS Code import, so the tests need no editor harness; `specShapeDiagnostics.ts` is the thin layer that owns the collection and the save listener.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. The retirement declaration is one optional key on an existing registry entry. A capability that omits it behaves exactly as today, and the whole feature is inert when living specs are off. |
| II. Spec-Driven Workflow | PASS. This strengthens the workflow's weakest joint: the moment a feature spec's deltas become the durable record. Nothing about the spec format or the pipeline's shape changes. |
| III. Visual and Interactive | PASS. Findings reach the developer where they already look for problems, on the line they are about, rather than in a message days later. |
| IV. Modular Architecture for Complex Features | PASS with a noted duplication. The checks exist in two runtimes because neither can call the other. The duplication is deliberate, bounded to one module per side, and held to one shared fixture set by a guard that fails when either side skips an example — the same arrangement the two requirement slicers already use. |

No unjustified violations, so there is no Complexity Tracking table.
