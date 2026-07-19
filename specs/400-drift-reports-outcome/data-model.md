# Data Model: Drift and fold-back summaries report outcome, not intent

## Drift result

The object `compute_drift` returns and `--json` prints. One field is added; nothing is removed or renamed, so every existing consumer keeps working.

| Field | Type | Meaning | Change |
|---|---|---|---|
| `enabled` | boolean | Whether the living-specs feature is on. When false the other fields are empty and nothing is rendered. | unchanged |
| `checked` | integer | How many capabilities were actually examined against a committed baseline. Equals the length of `capabilities`. | **new** |
| `capabilities` | list | One entry per examined capability, each carrying `name`, `spec`, `commit`, `drifted`, `inSync`. | unchanged |
| `skipped` | list | One entry per capability that could not be examined, each carrying `name` and a human-readable `reason`. | unchanged |

**Invariant**: every configured capability appears in exactly one of `capabilities` or `skipped`, so `checked + len(skipped)` is the number configured. This is what lets the summary state both halves without a third source.

**State the summary derives from**, and the only three cases it distinguishes:

| Condition | Rendered |
|---|---|
| `enabled` is false | nothing at all — the empty string |
| `checked == 0` and `skipped` is non-empty | the skip notes, then the counts line, and no success claim |
| `checked > 0`, no drift among the checked | the skip notes if any, then the success claim naming the checked count |
| `checked > 0`, drift among the checked | the skip notes if any, then the existing drift report, then the counts line |

The degenerate case where the feature is enabled but nothing is configured yields `checked == 0` with an empty `skipped`; it renders a plain statement that no capabilities are configured rather than a success claim, because a successful check of an empty set is the same lie in miniature.

## Applied delta counts

What `apply_deltas` reports back about its own work. The parsed deltas it receives are unchanged in shape; this is the outcome side.

| Field | Type | Meaning |
|---|---|---|
| `added` | integer | Requirements actually appended. Excludes those skipped as already present, since an idempotent re-fold adds nothing. |
| `modified` | integer | Requirements whose matching heading was found and replaced. Excludes those whose heading was not found. |
| `removed` | integer | Requirements whose matching heading was found and deleted. |
| `renamed` | integer | Headings actually rewritten. Excludes renames whose old heading was not found. |

**Relationship to the parsed deltas**: for every verb, the applied count is less than or equal to the parsed count. The difference is the number silently dropped, which is what the fold's log line now surfaces.

**Note on the "already up to date" case**: a fold where the resulting text equals the original is already reported separately by the fold, before the counts line is reached, and is not double-counted here. An `added` requirement skipped as already present contributes zero to `added`, which is what makes that separate report and these counts agree rather than contradict each other.
