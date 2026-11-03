# Data Model: Converge finishes a Companion spec

No new file or store is added. Everything lives in `.spec-context.json`, written only through `update_context` in `write-context.py`. This feature reshapes how three existing parts of that record behave around converge.

## Spec status

The record's `status` field. Values involved: `implementing`, `implemented`, `completed`.

Transitions:

- `implementing` to `implemented`: the last task is checked and implement closes with `--step implement --advance`. Implement never writes `completed` (FR-001).
- `implemented` to `completed`: a converge pass finishes having appended no task. Only the after-converge hook calls `mark_spec_complete`, the same for manual, auto and stock runs (FR-002).
- `implemented` to `implementing`: a converge pass finishes having appended tasks, so implement runs again (FR-003).
- `completed` to `completed`: a converge pass appends tasks. Status and `currentStep` are untouched and a concern is recorded (FR-005).

Validation: a status never moves backward, so no transition leaves `completed`. On a completed spec every write other than a converge start or finish is refused as before (FR-006). `_is_more_advanced` is not widened, because it also guards `--advance` and derive-from-files.

## Converge run record

Converge appears in `history[]` like any other step, as a start entry and a finish entry written by the before-converge and after-converge hooks.

- Start: step `converge`, a start timestamp, and `convergeStartedAt` set so the finish can tell which tasks the pass appended.
- Finish: step `converge`, a finish timestamp, and the count of tasks appended since `convergeStartedAt`. Zero means clean; one or more means not clean.
- A converge that stops before assessing writes no finish, so it never counts as clean (edge case).
- On a completed spec both entries are still appended (the one sanctioned write), by `_note_converge_on_completed`, which calls `append_capture_entries`. History only grows and the entries carry `by: extension`.
- For the doctor, the finish is traced as a `converge-finish` op and counted as a completion attempt. Plain `hook` trace ops are not counted.

## Open-task concern

A concern entry on the record, added only when a converge finish on a completed spec appended tasks.

- Fields: a message naming the open task count, plus the usual concern fields (time, `by`).
- Validation: count is at least 1. No concern is written when the count is zero, so a clean converge on a completed spec changes only the converge record (acceptance 3.2).
- Auto also writes a concern, of the same shape, when the pass cap is hit with tasks still open; it names the open tasks.
- Concerns do not move status or step.

## Three-pass cap

Not stored as a field. It is a rule in the auto prompt: run implement then converge, repeat until a converge pass appends nothing, and after the third pass stop.

- Pass 1 to 3 clean: the spec is `completed` through the after-converge hook.
- Third pass still appends tasks: auto stops with the spec at `implemented` and records the concern above (FR-004).
- The workflow engine has no loop, so its YAML ends on a single `speckit.converge` step in place of mark-complete. Its repeat is left to a person.
