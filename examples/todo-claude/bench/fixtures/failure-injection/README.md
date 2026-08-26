# Failure-injection fixture

Proves that a capture failure gets **recorded**, not just that a happy path traces. Two injections, both reproducing conditions that have actually stranded specs in real repositories:

| Injection | What it breaks | What the doctor must report |
|---|---|---|
| `missing-feature-json` | `.specify/feature.json` is removed mid-run, so the capture writer cannot resolve which spec a call belongs to | the call in the repo-level unattributed trace log, with the writer's own "could not resolve the active feature directory" message as the reason |
| `unwritable-context` | `.spec-context.json` is made read-only, so the write is attempted and fails | a recorded capture failure naming the write error, and a completion outcome that states why rather than leaving the spec silently stuck |

## Running it

```bash
node examples/todo-claude/bench/fixtures/failure-injection/inject.mjs <cell-dir> missing-feature-json
node examples/todo-claude/bench/fixtures/failure-injection/inject.mjs <cell-dir> unwritable-context
node examples/todo-claude/bench/fixtures/failure-injection/inject.mjs <cell-dir> restore
```

`restore` undoes both injections, so a cell can be reused. Injecting is deliberate and manual — nothing in the normal bench loop breaks a cell on its own.
