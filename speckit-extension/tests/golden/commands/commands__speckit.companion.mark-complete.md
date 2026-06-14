---
description: "Mark the active spec completed — the Companion workflow's terminal step (writes status: completed)"
---

# Mark Spec Complete

Promote the active feature to the terminal `completed` status in `.spec-context.json`. This is the
Companion workflow's final step: it runs after `implement` has finished so the spec lands at the
end of the Active → Completed lifecycle. The **command** writes `completed` via the shared
`write-context.py` path — you never hand-edit `.spec-context.json` to do it.

The stock `speckit` workflow has no terminal step and force-closes without ever writing `completed`;
this step is what gives the Companion pipeline its explicit completion gate.

## Prerequisites

- Verify Python is available by running `python3 --version`.
- If `python3` is not available, warn the user and skip:
  `[companion] Warning: python3 not detected; skipped mark-complete`.
  Do not fail the host command.

## Execution

Run the writer from the repository root:

```bash
python3 .specify/extensions/companion/scripts/write-context.py --mark-complete --by ai
```

The script resolves the active feature directory on its own (`--feature-dir` →
`SPECIFY_FEATURE_DIRECTORY` → `SPECIFY_FEATURE` → `.specify/feature.json` → git branch prefix).
Pass `--feature-dir specs/<NNN>-<slug>` when you already know it.

`--mark-complete` keeps `currentStep` at `implement` (the last real step) and sets `status:
completed`, preserving the canonical invariant that the last `history` entry's step equals
`currentStep`. It is the only sanctioned writer of `completed`.

## Graceful Degradation

Best-effort and idempotent:
- If `python3` is missing, skip with the warning above (never fail the host command).
- A spec already at `completed` or `archived` is left untouched — the script reports it and exits 0.

## Output

On success:
`[companion] Marked specs/<NNN>-<slug>/.spec-context.json complete (status=completed, by=ai)`.
