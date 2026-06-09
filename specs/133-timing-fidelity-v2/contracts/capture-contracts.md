# Phase 1 Contracts — Timing fidelity v2

This feature exposes no HTTP API. Its "contracts" are the CLI surface of `write-context.py`, the on-disk finish-only entry shape, and the reconciler's activation command. Each is testable.

## Contract 1 — `write-context.py` per-task finish (new path)

**Command**:
```
python3 .specify/extensions/companion/scripts/write-context.py \
  --feature-dir <dir> --step implement --task <TaskID> --kind complete --by extension
```

**Behavior**:
- Appends **exactly one** finish entry: `{ step: "implement", substep: "<TaskID>", task: "<TaskID>", kind: "complete", by: "<by>", at: <script clock, ms> }`. No paired `start`.
- **Idempotent**: if `<TaskID>` is already journaled (a `complete` exists for that task), it is a no-op.
- **Same-step safe**: succeeds when `currentStep == implement` even if `status == implemented` (does not trip the no-backward-clobber guard). Still refuses when the spec is cross-step terminal (`completed`/`archived`).
- Sets `currentTask`/`status` consistent with progress (`implementing` until all markers checked).
- Best-effort: never fails the host command (prints a warning, exits 0).

**Verification**: call twice for the same task → one entry. Call after a self-closed implement → entry still appended.

## Contract 2 — `sync_tasks` backstop (finish-only)

**Command** (run by the `after_implement` hook):
```
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <dir> --tasks-file <dir>/tasks.md
```

**Behavior change**:
- For each completed marker in `tasks.md` **not already journaled**, append a **single** finish entry (drop the prior `start`+`complete` pair).
- Relaxed guard: journals per-task even when implement was already closed (same-step); preserves the cross-step terminal guard.
- Closes the implement step (`status` → final, step-level `complete`) once every marker is checked, idempotently.
- Does not duplicate finishes the live path already wrote.

**Verification**: a run where the assistant journaled some tasks live + closed the step early → backstop fills only the missing tasks, totals match `tasks.md`, no duplicate `(task, kind)`.

## Contract 3 — finish-only history entry (shape both surfaces emit)

The timing partial (`timing-partial.md`) and the GUI preamble (`promptBuilder.ts`) MUST instruct the same shape:

- **Per task** (implement): after finishing a task, run Contract 1's command (script-stamped). Do **not** hand-author per-task JSON.
- **Per substep** (plan `research`/`design`, tasks `generate`): append a single finish `{ step, substep, kind: "complete", by: "ai", at: <date -u> }` the moment the substep ends — one entry, never two substeps sharing a timestamp.
- **Unchanged**: do not self-close `specify` or `implement` by hand; step-level closes remain deterministic.

**Verification**: `check_capture.py` finds one finish per task/substep, no `start`/`complete` per-task pair, `task-cadence` source is `live` with non-zero deltas.

## Contract 4 — reconciler activation command

**Before**: `specify preset add <id>` (catalog-form; no-op for bundled presets).
**After**: `specify preset add --dev .specify/extensions/companion/presets/<id>` for the `add` op; `enable`/`remove` stay id-form.

**Behavior**: toggling `templateProfile` to `standard`/`lean` results in `.specify/presets/<id>` existing (preset registered) and the matching command bodies re-emitted with the timing partial; `off` removes both; switching is mutually exclusive (removes run before the add). CLI failures are logged, not thrown.

**Verification**: set `templateProfile: lean` → reconcile → `.specify/presets/companion-lean` exists, `companion-standard` does not; the lean `speckit.plan` body produces the lean document shape on the next run with no manual command.

## Contract 5 — eval gate

`check_capture.py` updated to encode finish-only:
- per-task: accept a single `complete` per task (no required `start`); flag only a repeated `(task, kind)`.
- `task-cadence`: report `live (by:extension/ai script-stamped)` honest deltas as the healthy signal; the old "tight window expected" comment is replaced.

**Verification**: green (`--strict` exit 0) on a fresh **standard** run and a fresh **lean** run; `task-cadence` shows non-zero gaps.
