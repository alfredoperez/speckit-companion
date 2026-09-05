# Implementation Plan: The health check reports what it cannot currently see

**Spec**: [spec.md](./spec.md) · **Issue**: [#622](https://github.com/alfredoperez/speckit-companion/issues/622) · **Branch**: `604-doctor-blind-spots` · **Size**: normal

## Summary

Three blind spots stay open after #623, #628, #630 and #650, and each one is a reader that was never wired up rather than a mechanism that was never built. The marker for calls the trace could not record already exists and already has a reader, but `check_trace` returns "skipped" before it ever asks. The verification list already accepts writes, but nothing reads it to judge whether a step proved anything. And a step's start is stamped inside a content node, so the pre-hooks and any earlier node run outside the window the step later claims.

So the work is three small wirings. Move the marker read above `check_trace`'s early return. Add a `verification` check that asks whether a completed implement step recorded anything in `verified[]`, reporting no-record rather than a problem when there is nothing to read. And hoist the step-start stamp out of the content nodes into a shared command part that sits at the top of every step's assembled body, ahead of the extension hooks, so the stamp is the first instruction on every dispatch path instead of only on the extension's.

Nothing new is invented. `.trace-lost`, `_lost_entries`, and `verified[]` all ship today; the duplicate-start guard the hoist depends on (`_has_step_start`) already collapses repeat starts and already keeps the earliest, so FR-007 needs a test, not a code change.

## Project Structure

```
speckit-extension/
  scripts/
    doctor_checks.py            # check_trace: read the marker before the early return; new check_verification
    doctor.py                   # CHECKS tuple + run_check wiring for the new check
  presets/_parts/
    step-start.md               # NEW — the shared "stamp this step's start" block
  nodes/
    specify/_frame.md           # fence the new part above speckit-hooks
    plan/_frame.md
    tasks/_frame.md
    implement/_frame.md
    plan/gather-context.md      # drop the now-duplicated start stamp
    tasks/tasks-doc.md
    implement/implement-exec.md
    specify/resolve-dir.md
    specify/resolve-dir-git.md
    auto/resolve-dir.md
  tests/
    test_doctor.py              # marker-without-trace, verification check, no-record degradation
    test_context.py             # duplicate step start keeps the earlier timestamp
    test_node_boundaries.py     # every step frame carries the step-start part
    golden/commands/            # regenerated after the frame change
```

**Structure Decision**: everything lands in the existing `speckit-extension` layout. The two health-check behaviours go in `doctor_checks.py`, as the spec's Verbatim Constraints pin. The timing fix is a build-time change to how commands are assembled, so it lives in `presets/_parts` and the node frames, and the frozen command captures under `tests/golden/commands/` are regenerated as part of it.

## Key Decisions

**A shared part, not four copies of the stamp.** The parity gate exists to catch exactly the thing four inlined copies of one shell command would be. Copying the stamp into each `_frame.md` would fail `check-shape-parity` region equality the first time one drifted. The part is written step-agnostically, in the same idiom `speckit-hooks` already uses: "let `<step>` be this command's phase". One file, four fences.

**The part sits above the hooks fence, not below it.** A `before_plan` git commit is not the plan step's work, and on a repo with uncommitted changes it is not fast. Stamping first means the step's window opens before anything runs on its behalf.

**A new `verification` check, not a finding folded into `check_record`.** FR-005 wants "no record" as a *status*, not as a suppressed finding, and only a check of its own has a status. It slots into `CHECKS` after `completion`, since both judge how a step closed.

## Constitution Check

| Principle | Assessment |
| --- | --- |
| I. Extensibility and Configuration | **PASS** — the new part is assembled like every other part, so a recipe that reorders nodes still gets the stamp; no new setting is introduced. |
| II. Spec-Driven Workflow | **PASS** — the change makes the recorded lifecycle more accurate; no step, status or transition is added or renamed. |
| III. Visual and Interactive | **PASS** — the doctor's report is the surface, and the new check prints through the existing check/finding rendering. |
| IV. Modular Architecture | **PASS** — checks stay one-per-function in `doctor_checks.py`, registered in `doctor.py`; the timing change is a single shared part rather than per-command text. |

No violations, so there is no Complexity Tracking table.

## Phases

- **Phase 0 — Research**: see [research.md](./research.md). Settles where each reader attaches and why the start stamp moves to a part.
- **Phase 1 — Design**: [data-model.md](./data-model.md) for the three records this touches, and [contracts/](./contracts/) for the check and part identifiers a test codes against.
- **Phase 2 — Implementation**: task list generated by the next step.

## Risks

- **Golden drift.** Editing four `_frame.md` files changes every assembled command body, so `check-shape-parity`'s golden assertion fails until the captures are regenerated. That regeneration is a task, not a surprise.
- **A new entry in `CHECKS` changes report shape.** Anything asserting the check count or the full list needs updating alongside.
