# Data Model: Status shows the decisions a run actually recorded

## Recorded decision

One choice a run made, stored in the spec context's `decisions` list. Two forms occur on disk, and both are valid input.

| Form | Shape | Written by | Example |
|---|---|---|---|
| Entry | object with a `decision` key, optionally `why` and `rejected`, plus any unknown keys the writer preserved | every real Companion run, via the capture writer's JSON-or-text coercion | `{"decision": "Resize on the server", "why": "browsers vary", "rejected": "client-side canvas"}` |
| Bare text | a string | hand-authored context files and fixtures predating the coercion | `"Resize on the server"` |

**Fields**

| Field | Type | Required | Notes |
|---|---|---|---|
| `decision` | string | yes, for the entry form | The one-line choice. Blank or whitespace-only means the entry has no usable text. |
| `why` | string | no | The reason. Preserved on read; not shown by the default report. |
| `rejected` | string | no | The alternative not taken. Preserved on read; not shown by the default report. |

## Reading rules

The reader turns the stored list into an ordered list of display strings:

1. A non-empty string entry contributes itself, unchanged.
2. An entry object whose `decision` is a non-empty string contributes that text.
3. A bare number contributes its text, exactly as it did before this change. It is the one non-string form that already rendered, and a value that used to appear and now does not would be the same silent disappearance this change exists to remove.
4. Everything else — an object with no `decision`, an object whose `decision` is blank or not a string, a list, a null, a boolean — contributes nothing and does not stop the remaining entries from being read.
5. Recorded order is preserved. Nothing is de-duplicated, sorted, or truncated.
6. A `decisions` field that is absent, empty, or not a list yields an empty list.

Rule 4 is the difference from the previous behavior in both directions: it is what lets a real run's decisions through, and it is also what keeps a single malformed entry from taking the whole section down with it.

## Relationship to the other captured lists

| List | Stored form | Reader status |
|---|---|---|
| `decisions` | entry objects (`decision`) or strings | the reader fixed here |
| `verified` | entry objects (`what`) or strings | already reads both |
| `concerns` | entry objects (`note`) or strings | no reader in the capture runtime beyond the viewer, which reads both |
| `expectations` | plain strings only, by construction | string-only reading is correct |
| `context` | plain strings only, by construction | string-only reading is correct |

`expectations` and `context` go through a string-only writer, so their shape is guaranteed rather than merely conventional; widening a reader of those would add a branch no honest test can reach.

## State transitions

None. Decisions are append-only capture, de-duplicated on their text by the writer. This change touches only how they are read back.
