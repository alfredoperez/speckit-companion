# Data model

## Amendment (new)

One entry in `.spec-context.json` → `amendments` (a list; absent on older records).

| Field | Type | Rule |
|---|---|---|
| `what` | string | required; what changed in the spec |
| `why` | string | optional; the reason the person gave |
| `at` | ISO time | stamped by the writer when missing |
| `by` | `ai` \| `you` \| `extension` | defaults to `ai` |
| `replanned` | boolean | `true` when requirements were added or removed and plan reran; defaults to `false` |

Append-only: entries are never merged or replaced, even when two share `what`. Writing an amendment never touches `status`, `currentStep` or `history`.

`ViewerState.amendments` carries the list unchanged; malformed entries (no `what`) are dropped by the derivation.
