# Phase 0 Research: The health check reports what it cannot currently see

Everything below was read on `main` at `f4fe9170`, on the branch `604-doctor-blind-spots`.

## Decision — read the unrecorded-calls marker before `check_trace`'s early return

**Decision**: In `check_trace` (`speckit-extension/scripts/doctor_checks.py`), call `_lost_entries(feature_dir)` before the `read is None` branch returns, and emit the existing problem finding when the marker has entries even though `run_trace.read()` found no trace file. When there is neither a marker nor a trace, return the skip exactly as it reads today.

**Rationale**: The marker's whole purpose is the case where the trace could not be written, and that is precisely the case the early return currently swallows. `_lost_entries` already reads both the spec-level and repository-level `.trace-lost`, already tolerates an unreadable or missing file by returning an empty list, and already concatenates without double-counting because the two paths are distinct files. The fix is moving one call above one `return`; the finding text already exists further down the function.

**Alternatives considered**: A separate `lost` check with its own status row. Rejected — it would report a second "skipped" row on every healthy spec for a condition the trace check already owns, and it would split one story across two report sections.

## Decision — a `verification` check of its own, registered in `CHECKS`

**Decision**: Add `check_verification(feature_dir, ctx)` to `doctor_checks.py` and register it in `doctor.py` between `completion` and `template`. It reports a problem when `history[]` holds a step-level `complete` for `implement` and `ctx["verified"]` is empty or absent, and returns a skip ("no record") when implement never completed or the spec predates verification recording.

**Rationale**: FR-005 asks for "not applicable" as an outcome, and in this codebase that outcome is a `CheckStatus(..., "skipped", reason)`, which only a registered check can produce. Folding the logic into `check_record` would force it to be either a finding or nothing, which is the two-state shape the spec explicitly rejects. `_no_record` already supplies the shared "there is nothing to read" skip, and `_has_complete`-style step-level matching is already available from `spec_context`.

**Alternatives considered**: Judging every step, not just implement. Rejected — plan and tasks produce documents, not executions, so a missing verification there is normal and would fire on every clean run, which is how a report stops being read (the same reasoning that produced `_EXPECTED_DECLINE`).

## Decision — hoist the step-start stamp into a shared `step-start` part

**Decision**: Add `speckit-extension/presets/_parts/step-start.md` holding the step-agnostic stamp instruction, fence it into `specify/_frame.md`, `plan/_frame.md`, `tasks/_frame.md` and `implement/_frame.md` immediately above the `speckit-hooks` fence, and delete the stamp from the six content nodes that carry it today (`plan/gather-context.md`, `tasks/tasks-doc.md`, `implement/implement-exec.md`, `specify/resolve-dir.md`, `specify/resolve-dir-git.md`, `auto/resolve-dir.md`).

**Rationale**: The stamp is currently step 1 of a *content* node, which puts it after the frame's before-hooks and, for plan, after `size-budget` as well. The extension's own dispatch preamble already seeds a start carrying the dispatch timestamp, so the extension path is honest; every other path (a terminal `/speckit.companion.*`, the auto command's self-advance) gets the late stamp. A part at the top of the frame is the only place that is first on all of them. Writing it step-agnostically matches the idiom `speckit-hooks` already uses and satisfies the parity gate's region-equality rule, which four inlined copies would fail.

**Alternatives considered**: (a) Inline the stamp into each `_frame.md`. Rejected — four copies of one shared rule is the exact drift `check-shape-parity` assertion (a) exists to catch. (b) Have the VS Code extension write the seed itself rather than instructing the model to. Rejected as out of scope here: it is a real improvement, but it fixes only the path that is already honest and leaves the terminal path untouched.

## Decision — FR-007 needs a test, not code

**Decision**: Cover the duplicate-start behaviour with a test in `test_context.py`; change no code for it.

**Rationale**: `_has_step_start` in `spec_context.py` already matches any prior `start` for the same `(step, substep)` anywhere in the log, not just the last entry, and `history[]` is append-only, so the first start survives and the second is dropped. That is exactly FR-007. Verified by reading the guard and its docstring, which names this case. The hoist makes the guard load-bearing, so it earns a regression test even though nothing about it changes.

**Alternatives considered**: Adding an explicit earliest-wins comparison. Rejected — append-only history already gives it, and a second mechanism enforcing the same invariant is the kind of belt-and-braces that later disagrees with itself.

## Open question resolved — how the extension seeds the start today

`src/ai-providers/promptPreamble.ts:280` builds a "Pre-step seed" instruction telling the assistant to append the start entry using the **dispatch** timestamp. So the entry is written by the model but timed by the extension, which keeps it honest. Nothing in the timing fix disturbs it: the new part's stamp runs through `write-context.py`, and the duplicate guard collapses it against the seed.
