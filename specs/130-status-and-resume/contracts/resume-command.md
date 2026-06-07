# Contract: `/speckit.companion.resume`

A Companion-owned spec-kit command (markdown, run by the AI CLI) that continues the pipeline from where it stopped, carrying recorded decisions into scope.

## Invocation

```
/speckit.companion.resume            # active feature
```

Same feature-directory resolution as `/speckit.companion.status`.

## Behavior

1. Verify `python3`. If absent: warn and stop (do not fail the host).
2. Run `status-context.py` to obtain the `ResumeResolution` (`RESOLUTION: { … }` line).
3. Branch on the resolution:
   - `complete = true` → print `Pipeline complete — nothing to resume.` and stop.
   - `source = "derived"` and no files → print `Nothing to resume (no spec files or recorded state found).` and stop.
   - `currentStep = implement` with `nextTask` set → continue implementation at `nextTask` (the next unchecked task in `tasks.md` order).
   - otherwise → dispatch `nextCommand`.
4. When dispatching, the agent invokes the resolved `/speckit.*` command with the `decisions[]` array stated as in-scope context for that step.

## Dispatch contract

- Resume dispatches the **already-installed** `/speckit.*` commands; it does NOT require a `specify workflow resume` CLI subcommand (works on the stock installed spec-kit version). See research R2.
- The dispatched command runs its own `after_*` capture hook, which writes the resulting `history[]` entry — resume itself writes no state.

## Output contract

```
Resuming <specName> from <currentStep> (<status>).
Decisions in scope:
  - <decision 1>
Next: <nextActionLabel>  →  dispatching <nextCommand>
```

- Tasks step: `Next: Continue implementation at <nextTask>  →  dispatching /speckit.implement`.

## Exit behavior

Always exits 0 on the script step; never fails the host. If dispatch cannot proceed (e.g. unresolved next step), reports the reason rather than partially executing.

## Acceptance mapping

Covers FR-003, FR-004, FR-005, FR-006, FR-010, FR-011, FR-012 and SC-002 / SC-003 / SC-005. Edge cases: already-complete, missing-and-no-files, state/files disagreement.
