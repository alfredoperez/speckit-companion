# Data Model: Keep the request verbatim, and say who decided what

Three shapes change: the run record's `request`, a stored Decision, and the derived viewer shapes. Everything else in `.spec-context.json` is untouched. All new fields are optional, so older records stay valid.

## Request (run record field `request`)

| Field | Type | Rule |
|---|---|---|
| `request` | string | Top-level field of `.spec-context.json`. Write-once: the first non-empty value is kept and later writes are no-ops. |

Validation: only outer whitespace is trimmed; inner spacing, line breaks, quotes and markup are kept byte for byte. A blank or whitespace-only value is never stored, and the field stays absent. The text arrives through `--request <path|->` (file or stdin), never as a shell argument.

Written by auto's `resolve-dir` first, then specify's `resolve-dir`; the second write is ignored. Read by plan's `gather-context` when present.

## Decision (stored, in `decisions[]`)

| Field | Type | Rule |
|---|---|---|
| `decision` | string | The current answer. Required. |
| `why` | string | Optional reasoning. |
| `rejected` | string | Optional rejected alternative. |
| `id` | string | Optional stable key. Without it the entry cannot be reopened and de-duplicates by `decision` text, as today. |
| `by` | string | Who answered: `agent`, or a person's name (`you` when the caller does not know the name). The writer stamps `agent` when the caller omits it. |
| `at` | string | ISO-8601 UTC time. The writer stamps the write time when the caller omits it. |
| `earlier` | EarlierAnswer[] | Optional. Answers this decision replaced, oldest first. Only grows. |

Legacy bare-string decisions stay `{ decision }` only. They are not back-filled with `by` or `at`.

### EarlierAnswer (items of `earlier`)

| Field | Type | Rule |
|---|---|---|
| `decision` | string | The replaced answer. Required. |
| `why` | string | Copied from the replaced entry. |
| `rejected` | string | Copied from the replaced entry. |
| `by` | string | Copied from the replaced entry; absent if it had none. |
| `at` | string | Copied from the replaced entry; absent if it had none. |

An EarlierAnswer has no `id` and no `earlier` of its own. Any earlier answers the replaced entry already held come first in the new list.

### Relationships and state transition

A Decision belongs to one run record. `id` is unique within `decisions[]`; it links a new write to the stored entry it reopens.

| Write | Match | Result |
|---|---|---|
| Has `id`, no stored entry with that `id` | none | Appended as a new entry, `by` and `at` stamped if missing. |
| Has `id`, same `decision` as the stored entry | by `id` | No-op. Nothing added. |
| Has `id`, different `decision` | by `id` | The stored answer (with its `why`, `rejected`, `by`, `at`) is pushed to the end of `earlier`; the new answer takes its place in the same list position. |
| No `id` | by `decision` text | Appended, or a no-op if the text is already stored. Never reopens. |

Reopening twice leaves two entries in `earlier`, oldest first. No answer is ever dropped.

## Viewer shapes (derived, not stored)

Built once in `deriveViewerState` and `pickDecisions`; the component reads only these.

### ViewerState

| Field | Type | Rule |
|---|---|---|
| `request` | string \| undefined | Copy of the stored `request`. Absent when the record has none, and then no block renders. Rendered as plain text that wraps. |

### ViewerDecision (gains three fields)

| Field | Type | Rule |
|---|---|---|
| `by` | string \| undefined | Kept only when a non-empty string. Shown as "answered by <who>". |
| `at` | string \| undefined | Kept only when it parses as a time; formatted with `formatAbsolute`. An unreadable value is dropped, and the meta hides rather than breaking the row. |
| `earlier` | ViewerEarlier[] \| undefined | Each item is normalized the same way as `by` and `at`. Entries with no `decision` text are dropped. Rendered oldest first, indented and struck through, as "earlier answer · <who> · <when> · reopened". |

The "answered by" line shows only when `by` and a readable `at` are both known. Existing fields on ViewerDecision are unchanged.
