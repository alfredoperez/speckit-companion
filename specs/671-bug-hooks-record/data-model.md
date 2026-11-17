# Data Model

## Bug run record

`.specify/bugs/<slug>/.spec-context.json`, the spec record's shape. Only `history` is written by this feature.

| Field | Value |
|---|---|
| `step` | `assess`, `fix` or `test` |
| `kind` | `start` (before hook) or `complete` (after hook) |
| `at` | ISO UTC stamp |
| `by` | `extension` (the hook script writes it) |
| `did` | on `complete`: the report's outcome when it is a known value, e.g. `valid`, `partial`, `verified` |

## Stage state (derived in the pane)

| Record | State shown |
|---|---|
| start and complete | done, with the time between them and the outcome |
| start, no complete, a later stage started | stopped |
| start, no complete, nothing later | running |
| nothing | not shown |
