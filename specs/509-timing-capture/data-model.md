# Data Model: step boundary ownership in `history[]`

No schema changes. The entity reshaped is the per-step pair of `history[]` boundary entries — who writes each, and in what order. `S` = start, `C` = complete, all step-level (`substep: null`, no `task`).

## Before (the defect)

| Step | S writer | S `by` | C writer | C `by` | Order |
|---|---|---|---|---|---|
| specify | body script | extension | body script | extension | S → C ✓ |
| plan | after_plan hook (default kind) | extension | AI `--finish` | ai | **C → S ✗** |
| tasks | after_tasks hook (default kind) | extension | AI `--finish` | ai | **C → S ✗** |
| implement | body script | extension | after_implement hook / watcher | extension | S → C ✓ |

Trusted spans: implement only (specify's close boundary is plan's first entry — a `by:ai` complete, not a trusted shape).

## After (the fix)

| Step | S writer | S `by` | C writer | C `by` | Order |
|---|---|---|---|---|---|
| specify | body script | extension | body script | extension | S → C ✓ |
| plan | body script (step 1) | extension | after_plan hook (`--kind complete`) | extension | S → C ✓ |
| tasks | body script (step 1) | extension | after_tasks hook (`--kind complete`) | extension | S → C ✓ |
| implement | body script | extension | after_implement hook / watcher | extension | S → C ✓ |

Trusted spans: all four. Clarify/analyze remain AI-finish-only (no hooks), untrusted for duration — unchanged.

## Validation rules already enforced (unchanged, load-bearing)

- A step is started once: a redundant start (GUI seed + body script) collapses at write time, preserving the derivation's single-extension-start requirement.
- Completion append is idempotent per `(step, substep)` — first writer wins, which is why the AI's step-level self-close for plan/tasks must be removed rather than left to race the hook.
- Status flips are forward-only (`_is_more_advanced`), so a re-run of an earlier step never regresses a spec.
- Legacy inverted records (C before S) keep deriving as untrusted — no migration, no retroactive trust.

## Per-task events (cadence, not schema)

Unchanged shape: one `complete` line per task appended to `.spec-context.events.jsonl`, folded into `history[]`/`task_summaries` by materialize. What changes is *when* the fold runs: per task (main agent, foreground) instead of per wave.
