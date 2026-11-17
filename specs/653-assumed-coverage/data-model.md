# Data Model: "Assumed" is a coverage state

| Entity | Field | Type | Rule |
|---|---|---|---|
| Coverage entry (`coverage[req]`) | `assumes` | string, optional | Trimmed; blank is not stored; a new value replaces the old; title, tasks and tests are kept |
| `ViewerCoverageRow` | `assumes` | string, optional | Present only when non-blank |

A row's state: **tested** when it has tests (or **missing** when a named test is not on disk), else **assumed** when it has `assumes`, else **untraced**. Traced = tested, missing or assumed.
