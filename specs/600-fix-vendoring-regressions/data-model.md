# Data Model: Fix 0.20.2 Vendoring Regressions

No new entities. Three existing structures get their invariants restored.

## Rollback accumulator (`done`)

A list of `(from, to)` relative-path pairs, one per applied move, owned by `relocate()` and passed into `_apply_moves` by reference.

- **Invariant restored**: the list reflects every move that has landed on disk at any instant, including mid-batch — so the `except` handler can always roll back exactly what was done.
- **State transitions**: empty → grows one pair per successful `_move` → consumed newest-first by `_rollback` on any failure, or discarded on success.

## Lifecycle history log (`history[]` in `.spec-context.json`)

Append-only list of `{step, substep, kind, by, at}` entries with two writers (`write-context.py`, `derive-from-files.py`).

- **Invariant restored**: at most one `kind: "start"` entry per `(step, substep)` — both writers guard with `_has_step_start` before appending.

## Living-spec registry (`.specify/living-specs.yml`)

YAML file written by `register-capability._write_registry` and `relocate-capability._write_config`.

- **Invariant restored**: every write is atomic (temp file, then rename), so the on-disk file is always the previous or the new state — never truncated.
