# Data Model

| Entity | Field | Type | Rule |
|---|---|---|---|
| Run check (`verified[]`, `source: derived`) | `commit` | string | Short HEAD sha after the command; absent outside git |
| | `tree` | string | Snapshot tree of the working files after the command; absent on failure |
| `ViewerVerification` | `commit`, `tree` | string | Passed through for derived checks only, hex-checked |
| | `changedSince` | number | Files changed since `tree`, outside `specs/` and `.specify/`; undefined when it cannot be compared |
