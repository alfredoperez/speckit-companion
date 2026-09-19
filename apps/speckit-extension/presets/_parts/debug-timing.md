## Debug timing: this run is instrumented

**`debug: true` is set in this project's `.specify/companion.yml`.** A developer flipped it, temporarily, to find out where a step's time goes. It changes nothing about *what* you produce: same artifacts, same structure, same quality bar. It asks you for one extra thing, a boundary record at each named section of this command's body, so the step's internal shape is measurable instead of guessed at.

**Record each section boundary the moment that section's work ends.** Never batch them at the end, which stamps every boundary at one instant and measures nothing:

```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --step <this step> --substep <section> --finish --by ai
```

Use the section's own name as `<section>`: the numbered step or named node you just finished (`resolve-dir`, `draft-spec`, `classify-size`, `gather-context`, `plan-doc`, `tasks-doc`, `implement-exec`, and so on). These are ordinary substep finishes: one call each, finish-only, stamped by the script from the real clock. The gap between consecutive finishes is that section's duration.

Two rules keep the instrumentation honest:

- **Never a `start` for a section.** A start/finish pair written at one moment produces a zero-length tick and hides the real cadence.
- **The substeps this command already records stay exactly as they are.** Debug adds boundaries; it never renames or replaces the ones the command already emits.

Turning the flag off re-renders these bodies without this section.
