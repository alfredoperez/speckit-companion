# Research

## Move legality without a host answer

**Decision**: compute each place in the webview from `reads`, the step's other nodes' `reads`, and `pinned`, worded as `config_write.check_order` words its refusals.
**Rationale**: the host exposes no per-place answer; the rules are small and the data is in the graph. The writer still refuses anything this misses.
**Alternatives considered**: a new host message asking per place (a protocol change this slice may not make); offering every place and letting the write refuse (the old dead-button problem).

## Which steps auto runs

**Decision**: the shipped steps that take a turn in the run (`inSequence && !own`), shown only when the graph has an `auto` step.
**Rationale**: the auto orchestrator dispatches a fixed list (specify, plan, tasks, implement); a step the project adds is never on it.
**Alternatives considered**: a host flag (not available).

## Undo row

**Decision**: remember the removed node's step, phase, place and name when the removal is sent; draw the struck row while `status.undo.token` equals `remove:<step>:<node>`.
**Rationale**: the host builds that exact token, so the row shows only while the undo is really on offer.
**Alternatives considered**: a timer (would offer an undo the host already dropped).

## One modal

**Decision**: extend `HookModal` with a `mode` and two panels rather than a second modal.
**Rationale**: the focus trap, layering, sheet form and footer already exist there.
**Alternatives considered**: a new `AddModal` wrapping three forms (duplicates the shell).
