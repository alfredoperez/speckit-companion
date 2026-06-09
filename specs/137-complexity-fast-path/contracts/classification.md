# Contract: Classification (turbo specify command body)

The classify step runs after the spec is drafted, before deciding ceremony. It is AI-prompt logic, not code; this contract is the behavior the eval asserts.

## Inputs

- The drafted `spec.md` requirements (richer than the raw description).
- `complexityFastPath` boolean read from `.specify/companion.yml`.
- Fixed threshold: **5 files / 10 tasks** (constant in the body; mirrors the tiny-change guardrail).

## Decision

```
fastPathEnabled = read complexityFastPath from .specify/companion.yml (default false — opt-in beta)

projectedFiles  = estimate from drafted requirements
projectedTasks  = estimate from drafted requirements
scopeSignal     = "larger" if description/requirements contain rewrite|overhaul|new system|...
                  "smaller" if one-line|rename|typo|...
                  else "none"

crossedGuardrail = projectedFiles > 5 OR projectedTasks > 10

verdict = "simple" if  fastPathEnabled
                   and projectedFiles <= 5
                   and projectedTasks <= 10
                   and scopeSignal != "larger"
          else "normal"
```

## Outputs / observable behavior

| Condition | Behavior |
|---|---|
| `verdict == "simple"` | Run the **minimal-mode branch** (combined artifact + lifecycle fold + land at implement). |
| `verdict == "normal"` | Write `spec.md` only; full pipeline continues (plan → tasks → implement). |
| `crossedGuardrail == true` | Emit `[companion] Change exceeds the small-change guardrail (5 files / 10 tasks) — running the full pipeline.` then run normal. |
| `fastPathEnabled == false` | Always `normal`, no combining, no warning. |
| Weak / conflicting signals | `normal` (safe default). |

## Acceptance mapping

- FR-001/002/003 → the decision block above.
- FR-006 / SC-003 → the guardrail-warning row.
- FR-007 / SC-004 → the `fastPathEnabled == false` row.
- Edge "conflicting signals" → `scopeSignal == "larger"` forces normal.
- Edge "boundary at threshold" → `<= 5` / `<= 10` keeps exactly-at-threshold `simple`.
