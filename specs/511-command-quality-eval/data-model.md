# Data Model: Command-Quality Eval

## Quality report

The checker produces an ordered list of rows, one per check, same shape as `check_capture.py`'s report plus the WARN tier:

| field | type | meaning |
|---|---|---|
| `status` | `PASS \| WARN \| FAIL \| INFO` | severity; WARN never affects the exit code |
| `id` | string | stable check id, kebab-case (e.g. `verbosity-plan`, `burst-journaling`, `never-prompts-mark-complete`) |
| `detail` | string | one-sentence answer naming the gate that failed (measured value vs threshold, or the offending line) |

Aggregates: `failed` and `warned` counts. JSON output is `{ "checks": [...], "failed": n, "warned": n }`.

## Budget table

One module-level constant, the single home of every verbosity threshold:

```
BUDGETS = { artifact-name → (warn_lines, fail_lines, warn_chars, fail_chars) }
```

Artifacts scored: `spec.md`, `plan.md`, `tasks.md`. A missing or small artifact yields PASS/INFO — only oversize is this eval's defect.

## Timing constants

| constant | value | used by |
|---|---|---|
| `DETERMINISTIC_BY` | `{extension, derive, cli, user}` | trusted-boundary test (same set as `check_capture.py`) |
| `BURST_WINDOW_SECONDS` | `1.0` | burst-journaling FAIL |
| `BURST_MIN_FINISHES` | `3` | minimum sample for the burst verdict |
| `OUTLIER_FACTOR` | `8` | step-duration outlier (× median of other trusted spans) |
| `OUTLIER_FLOOR_SECONDS` | `300` | outlier only when also above this absolute floor |

## Prompting roster

Two explicit sets of files (enumerated, not prefix-derived — the contract is per-command semantics):

- `NEVER_PROMPT`: `speckit.companion.after-specify.md`, `after-plan`, `after-tasks`, `after-implement`, `living-drift`, `living-sync`, `living-coverage`, `mark-complete`, `status`, `resume`, `classify` (all under `--commands-dir`).
- `MUST_ASK`: `speckit.clarify.md` under the sibling `presets/companion-standard/commands/` directory.

A roster entry missing on disk is a FAIL row, never a silent skip.

## History entry (read-only input)

The checker consumes the canonical `.spec-context.json` `history[]` entries (`step`, `substep`, `task`, `kind`, `by`, `at`) exactly as `check_capture.py` does; it never writes the file.
