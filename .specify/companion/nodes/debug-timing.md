# Debug timing

Debug timing is on for this project. It changes nothing about **what** you produce — same artifacts, same structure, same quality bar. It asks for one extra thing: a boundary record at each named section of this command's body, so the step's internal shape is measurable instead of guessed at.

**Record each boundary the moment that section's work ends** — never batched at the end, which would stamp every boundary at one instant and measure nothing:

```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --step <this step> --substep <section> --finish --by ai
```

Use the section's own name as `<section>` — the node or numbered step you just finished (`resolve-dir`, `draft-spec`, `classify-size`, `gather-context`, `plan-doc`, `tasks-doc`, `implement-exec`, and so on).

Two rules keep it honest:

- **Never write a `start` for a section.** A start/finish pair written at one moment produces a zero-length tick and hides the real cadence — the failure this timing model exists to avoid.
- **The substeps this command already records stay exactly as they are.** Debug adds boundaries; it never renames or replaces them.
