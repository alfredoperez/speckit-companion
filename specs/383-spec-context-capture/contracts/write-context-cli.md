# Contract: `write-context.py` capture flags

The interface command bodies (and any future GUI action) code against. All flags are **best-effort**: missing `python3`, missing script, or a malformed value must never fail the host command. Every write is atomic and idempotent (re-running with the same value changes nothing).

## New flags

| Flag | Repeatable | Value | Writes | Guarantee |
|---|---|---|---|---|
| `--expectation <text>` | yes | plain string | `expectations[]` | de-duped append, first-seen order |
| `--decision <json\|text>` | yes | JSON obj with `decision` key, or bare text | `decisions[]` | de-duped on `decision`; bare text wraps as `{decision}` |
| `--verified <json\|text>` | yes | JSON obj with `what` key, or bare text | `verified[]` | de-duped on `what` |
| `--concern <json\|text>` | yes | JSON obj with `note` key, or bare text | `concerns[]` | de-duped on `note` |
| `--coverage-req <id>` (+ `--tasks <csv>` `--tests <csv>`) | per call | requirement id + csv lists | `coverage{<id>}` | upsert; non-destructive merge (only supplied lists replace) |
| `--step-summary <json\|text>` (uses `--step`) | per call | JSON obj with `summary`, or bare text | `step_summaries{<step>}` | upsert by step |
| `--classification <json>` | once | JSON obj, `verdict` required | `classification` | overwrite |

## Existing flags reused (zero new code)

| Call | Writes |
|---|---|
| `--set intent="<goal>"` | `intent` |
| `--set approach="<how-summary>"` | `approach` |
| `--set last_action="<breadcrumb>"` | `last_action` (incl. skip-markers like `"living specs evaluated — skipped (not configured)"`) |

## Invariants (unchanged)

- None of these flags touch `history[]`, `status`, or `currentStep` — capture is never lifecycle.
- `PROTECTED_SET_KEYS` still refuses lifecycle keys through `--set`.
- `--mark-complete` remains the only writer of `status: completed`.
- New flags compose with `--feature-dir`; without it the feature dir resolves from `.specify/feature.json` exactly as today.
- Exit codes: `0` on success and on tolerated no-ops; `2` only on caller errors (e.g. `--coverage-req` without id, unparseable `--classification`).

## Emission points (which body runs what)

| Lifecycle point | Calls |
|---|---|
| specify complete | `--set intent=…` · `--expectation …` (per non-goal) · `--classification '<json>'` |
| plan complete | `--set approach=…` · `--decision …` (per decision) · `--step-summary …` |
| tasks complete | `--coverage-req <FR> --tasks <csv>` (per requirement) · `--step-summary …` |
| implement close | `--verified …` (per check) · `--decision …` (implementation decisions) · `--concern …` (or none) · `--coverage-req <FR> --tests <csv>` · `--step-summary …` · `--set last_action=…` |
| any gate skipped | `--set last_action="<what> evaluated — skipped (<why>)"` |
