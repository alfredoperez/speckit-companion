# Data Model: Requirement Coverage Badges

## Requirement coverage

A map from requirement key to label, for one capability.

| Field | Meaning |
|---|---|
| key | The requirement's heading passed through `requirementKey`, the key drifted marks, new marks and links already share. |
| value | The label, `N tests`, `1 test` or `F/N tests`. Built from two integers, never from file text. |

Rules:

- A requirement whose coverage line names no test has no entry. There is never an entry worth `0` or an empty string.
- The map is absent, not empty, when there is no coverage file, the file cannot be read, or no requirement has a mapped test.
- Two requirements with the same key share one entry.
- Every test path is resolved inside the workspace before it is checked. A path that escapes it counts as not found.

## Capability health

`CapabilityHealth` and `LivingHeaderMeta` each gain one optional field, `requirementCoverage`, holding the map above. It travels with `coverage`, `drifted`, `driftedRequirements` and `newRequirements`. The webview holds it in the card renderer's existing store and drops it when the panel's spec path changes.
