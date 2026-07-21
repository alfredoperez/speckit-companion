# Research: timing capture boundaries and cadence

## Verified root causes (current main)

- **Per-wave cadence**: `speckit-extension/presets/_parts/timing.md` instructs "fold the appended lines … once per wave", and `nodes/implement/implement-exec.md` step 4 materializes only at each wave join. Per-task `--append` lines land in `.spec-context.events.jsonl`, which the viewer does not watch; only `--materialize` touches the watched `.spec-context.json` + `tasks.md`. Hence the 484 run's two-burst panel (T001–T009 in one fold, T010–T012 in another).
- **Inverted boundaries**: plan/tasks have no start capture in their bodies. The `after_plan`/`after_tasks` hook commands call the writer with the default `--kind start`, which lands an extension-stamped start *after* the AI's `--finish --by ai` self-close (484: plan complete 04:58:08, plan start 04:58:18). `deriveStepHistory`'s trust rule (`completionBeforeStart`) rightly rejects the span; specify is collateral damage because its close boundary is the next group's first entry, which under the inversion is plan's `by:ai` complete — not a trusted boundary shape.

## Decisions

### D1 — Approach (b): extension stamps both boundaries

**Decision**: plan/tasks bodies open with `write-context.py --step <step> --status <planning|tasking> --kind start --by extension`; the after-step hooks switch to `--kind complete`; the timing part drops plan/tasks from the AI self-close set.
**Rationale**: the command body is the only surface every dispatch path shares (GUI, skill chain, auto, workflow engine); the after-hook is the only surface that reliably runs at the step's true end. Approach (a) (stamp at GUI dispatch) covers only the GUI path — the 484 run never touched the GUI at plan/tasks dispatch, which is exactly why its starts were missing until the hook fired.
**Alternatives considered**: (a) synchronous GUI-dispatch stamping — rejected as path-incomplete; keeping AI self-close and teaching derivation to trust `by:ai` closes — rejected, it would abandon the "extension-stamped or untrusted" honesty rule.

### D2 — No change to `deriveStepHistory`

**Decision**: leave the derivation untouched; prove the fix with new tests.
**Rationale**: with ordering fixed, each step has exactly one extension start, and its close is either its own extension complete (implement, and plan/tasks when the hook fires) or the next step's extension start (specify always; plan/tasks when a hook is skipped) — both already trusted shapes. Rewriting close-preference (own complete vs next start) would change rendered spans for every existing spec and is out of scope.
**Alternatives considered**: preferring a step's own completion over the next step's boundary for `completedAt` — deferred; it changes display semantics for historical data and is not needed for 4-of-4.

### D3 — The writer's idempotency makes the ordering safe

**Decision**: rely on existing writer semantics — no Python changes.
**Rationale**: `update_context` skips a redundant start when one exists (so a GUI-seeded start + body start collapse to one entry, keeping the derivation's single-start requirement), `append_complete` is idempotent per `(step, substep)`, and `--kind complete` through the default step path flips status with the forward-only `_is_more_advanced` guard. The order matters one way: the AI self-close had to be *removed* for plan/tasks, because an earlier `by:ai` complete would win the idempotency race and the hook's `by:extension` complete would be skipped — the exact reason approach (b) includes the timing-part change.

### D4 — Per-task fold by the main agent only

**Decision**: implement-exec step 3 makes recording a task's finish a two-call closing action — append, then materialize — executed by the MAIN agent, foreground, one task at a time; subagent workers append only, and the main agent folds each worker's finish as it returns. The wave join keeps a reconcile + backstop materialize.
**Rationale**: `--materialize` is a read-modify-write of `.spec-context.json` + `tasks.md`; naming one serializing writer is the review-checklist rule the current wording violates. Folding is idempotent, so per-task folding plus the wave-join backstop can never double-count.
**Alternatives considered**: having workers materialize their own finishes — rejected (concurrent read-modify-write of the shared file); watching the sidecar from the extension — rejected (extension-side change duplicating an existing fold path, and the sidecar is deliberately unwatched).

### D5 — Committed stock emissions refresh with the part

The tracked `.claude/skills/speckit-*/SKILL.md` files are committed emissions of the companion-standard preset bodies and carry the timing part; after the part edit and body regeneration they are refreshed in the same change so no committed copy carries the retired cadence.
