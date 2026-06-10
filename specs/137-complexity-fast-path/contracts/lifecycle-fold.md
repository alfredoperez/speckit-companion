# Contract: Lifecycle Fold (write-context.py calls)

For a fast-tracked (`simple`) spec, the minimal-mode branch records folded plan and tasks steps so the viewer reads them as satisfied, not missing (FR-010).

## Calls (in order, after the combined artifact is written)

```bash
# specify already self-closed via the standard timing partial (complete, by: ai)

python3 .specify/extensions/companion/scripts/write-context.py \
  --feature-dir <dir> --step plan  --kind start    --substep fast-path --by ai
python3 .specify/extensions/companion/scripts/write-context.py \
  --feature-dir <dir> --step plan  --kind complete --substep fast-path --by ai
python3 .specify/extensions/companion/scripts/write-context.py \
  --feature-dir <dir> --step tasks --kind start    --substep fast-path --by ai
python3 .specify/extensions/companion/scripts/write-context.py \
  --feature-dir <dir> --step tasks --kind complete --substep fast-path \
  --status ready-to-implement --by ai
```

(Each call runs a fresh `date -u` internally — timestamps are real, never hand-written. If `write-context.py` does not yet accept `--substep`, that flag is added as part of this feature.)

## Postconditions

- `history[]` ends with `tasks / complete / substep="fast-path"`.
- `currentStep` lands so the spec is ready for implement; `status == "ready-to-implement"`.
- Last `history[]` entry's `step` aligns with the rendered progress (no phantom "Generating plan…").
- No `completed` status is written — the user still triggers implement and the final completed gate.

## Normal path (contrast)

A `normal` spec writes nothing here — plan and tasks are recorded by their own `/speckit.companion.plan` and `/speckit.companion.tasks` runs as today.
