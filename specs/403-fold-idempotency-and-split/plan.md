# Implementation Plan — Repeatable folding, and a context script small enough to reason about

**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md) · **Data model**: [data-model.md](./data-model.md) · **Contract**: [contracts/cli.md](./contracts/cli.md)

## Summary

Two changes, in order, as two commits. First, folding a feature spec's requirement changes into a living spec becomes repeatable for every combination of change verbs, by making the "add" verb aware of the renames declared alongside it and by letting an edit of the same requirement supply the final body. Second, the 1860-line script that holds that logic is split into focused sibling modules and its flag dispatch stops dropping data, with the command line held byte-identical throughout.

No new dependencies and no new tooling. Everything stays stdlib Python, the same files ship, and the same commands call them.

## Project Structure

```
speckit-extension/
├── scripts/
│   ├── write-context.py        # keeps the CLI, lifecycle, journal, promotion, guards; re-exports the moved names
│   ├── spec_context.py         # NEW — the shared store: read, atomic write, feature-dir resolution, history log, git helpers, vocabulary
│   ├── spec_deltas.py          # NEW — delta parsing and its grammar; no file access
│   ├── living_spec_fold.py     # NEW — apply_deltas, fold_living_spec, target resolution, requirement spans, the initial scaffold
│   ├── task_sync.py            # NEW — sync_tasks, task-marker parsing, checkbox writing
│   ├── capture.py              # NEW — decisions, verifications, concerns, expectations, coverage, step summaries, classification, entry coercion
│   ├── package-manifest.py     # RUNTIME_SCRIPTS gains the five new modules
│   ├── derive-from-files.py    # unchanged — reaches the moved names through write-context.py
│   └── status-context.py       # unchanged — same
└── tests/
    ├── test_living_specs.py    # gains the idempotency matrix, the growth test, and the triples
    ├── test_context.py         # gains the multi-flag dispatch test
    └── test_packaging.py       # unchanged; the gate it runs now covers five more scripts
```

**Structure Decision**: five new sibling modules in the existing scripts folder, imported by plain name after the script puts its own directory on the import path. Plain imports are what the packaging gate scans to derive what ships, so this form keeps the new modules visible to that gate rather than hidden behind a dynamic load.

## Constitution Check

No project constitution file is present (`.specify/memory/constitution.md` does not exist), so the standing repository conventions in `CLAUDE.md` and the review checklist serve as the gate.

| Principle | Assessment |
|---|---|
| Docs are part of the change, not a follow-up | PASS — the capture-and-timing reference and the architecture reference are updated in the same change, plus an unreleased changelog entry per half |
| A change under `speckit-extension/` touches its own README and CHANGELOG, never the root ones | PASS — root README and CHANGELOG untouched |
| Feature branches do not bump versions | PASS — `extension.yml` version, the README badge, and the publishing doc are all left alone |
| Default to no comment; no spec or issue identifiers in code comments | PASS — module docstrings state what each module is for; no issue numbers in code |
| A new gate needs a test proving it fails | PASS — the idempotency matrix is verified to go red against the pre-fix function, and the dispatch test is verified to go red against the pre-fix ladder |
| A test must exercise the real code path, not re-implement the condition | PASS — the matrix drives the shipped applier; the dispatch test drives the real command line entry point |
| A release-critical list must be machine-readable and gated | PASS — the new modules are added to the packing list the gate reads, not to any prose |
| Markdown paragraphs are not hard-wrapped | PASS |

No violations, so there is no Complexity Tracking table. The one deviation from the issue's literal proposal — a fifth module rather than four — is a design choice recorded in research.md with its reasoning, not a convention violation.

## How the work is sequenced

**Commit 1 — the fold fix (#465).** Land the rename-aware add inside the existing file, with the full test matrix green, before a single line moves. The tests are written first and confirmed red against today's code, so the matrix is proven to be measuring something.

**Commit 2 — the split (#458).** Move code without editing it, module by module, running the full verification set after each move so a break is attributable to one move. The dispatch fix goes in this commit because it lives in the arg-handling code the commit is already restructuring.

The order matters: the fold fix travels with its function through the move, so the move's diff stays a pure relocation.

## Verification set

Run after each move, and again at the end:

- The extension's own Python suites.
- The repository's TypeScript compile and test run.
- The shape-parity check and the two command-assembly checks.
- The packaging gate, which must stay clean in both directions — nothing needed but unpacked, nothing packed but unreachable.
- The differential command-line comparison described in research.md, over the full flag matrix.
- The living-spec eval check, whose repeatability assertion has been failing for legitimate input and must now pass.
