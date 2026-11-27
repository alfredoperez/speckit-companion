# Data model

## Hook status (new, derived in the webview)

| Field | Meaning |
|---|---|
| `word` | What the row says: `not installed`, `plugin off`, `can't call`, `unchecked`, `ran`, `skipped`, `not seen`. |
| `tone` | `problem`, `ran`, `quiet` (skipped) or `unseen`; picks the colour and whether the dot is filled. |
| `reason` | The full sentence for the popover: the problem text, the run's reason, "No trace of it in the run record." or "Changed since the last run." |

Rules, in order:

1. `hook.problem` set: tone `problem`, word from the problem's short form, reason the problem.
2. No run record, or it names no spec: no status.
3. A run under `${step}/${when}/${anchor}/${index}` with the same type and ref: `ran` or `skipped`, reason the run's own.
4. A run there with a different type or ref: `not seen`, reason "Changed since the last run."
5. No run there: `not seen`, reason "No trace of it in the run record."

Reads the existing `PipelineHook` and `HookRunsAnswer`; reshapes neither.
