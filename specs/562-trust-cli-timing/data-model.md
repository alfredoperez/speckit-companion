# Data Model: Trust timing from CLI-only runs

No persisted schema changes. One derived, in-memory concept is introduced.

## Boundary writer rank (derived, not persisted)

A pure function of a history entry's `by` field, used only inside the trust derivation:

| Tier | `by` values | Rank | Meaning |
|---|---|---|---|
| Instrumented | `extension`, `cli`, `derive`, `user` | 2 | Host- or in-command-script-observed boundary |
| Agent | `ai` | 1 | A CLI/agent run's own `write-context.py`-stamped boundary |
| Unrecognized | anything else / absent | 0 | Never anchors a trusted span |

**Rules**:
- A trusted span needs exactly one step-level start with rank > 0.
- Its close (own step-level complete, or the next lifecycle step's start) needs rank > 0 AND rank ≥ the start's rank.
- All existing ordering/anomaly guards (single start, no completion-before-start, no competing later start, no cross-phase overlap) are unchanged and apply on top.

The existing `HistoryEntry.by` field (schema enum `extension | user | cli | ai | derive`) is the only input; no new field is written to `.spec-context.json`.
