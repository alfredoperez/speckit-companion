# Data Model: The health check reports what it cannot currently see

No new persisted record is introduced. All three records below already exist and already have writers; this feature adds readers and moves when one of them is written.

## Unrecorded-calls marker (`.trace-lost`)

The file `run_trace` leaves when a capture succeeded but appending its trace line did not. Named by `run_trace.LOST_NAME`.

| Aspect | Value |
| --- | --- |
| Locations | `<feature_dir>/.trace-lost` and `<feature_dir>/../.trace-lost` (repository-level). Both are read; they are distinct files, so entries never double-count. |
| Shape | Plain text, one reason per line. Blank lines ignored. |
| Reader | `_lost_entries(feature_dir)` in `doctor_checks.py` — already written. |
| Absent / unreadable | Returns `[]`. An `OSError` on either path skips that path and continues; a missing `run_trace` import returns `[]`. Never raises. |
| Change here | None to the file. `check_trace` starts consulting the reader before it decides the spec has no trace evidence. |

**Validation**: an empty or whitespace-only marker yields no entries and is indistinguishable from an absent one — matching the spec's edge case that it is treated as absent, never as a crash.

## Verification record (`verified[]`)

The list of checks a run actually executed, on `.spec-context.json`.

| Aspect | Value |
| --- | --- |
| Location | `ctx["verified"]` |
| Shape | A list whose entries are objects keyed on `what` (the identity used for de-duplication), optionally carrying `result` and `at`; a bare string entry is also accepted by existing readers. |
| Writers | `write-context.py --verified` and the `verified` key of `--batch`, both routed through `append_capture_entries(feature_dir, "verified", "what", …)`. |
| Existing reader | `doctor_drift._recorded_claims`, which reads the same list for drift claims and already tolerates strings, dicts and malformed entries. |
| Change here | A second reader that asks only whether the list is non-empty when implement completed. It does not interpret entry contents. |

**Validation**: absent, `null`, `[]`, or a non-list value all count as "nothing verified". A non-list is treated as empty rather than as an error, so a malformed context degrades to a finding, never a crash.

## Step boundary (`history[]` step-level entries)

| Aspect | Value |
| --- | --- |
| Location | `ctx["history"]` |
| Entry shape | `{ step, substep, kind, by, at }`, with `substep: null` and no `task` for a step-level boundary. |
| Kinds | `start` and `complete`. |
| Identity for a start | `(step, substep)`. `_has_step_start` matches on that pair anywhere in the log. |
| Ordering rule | Append-only. The first `start` for a pair is the one that survives; a later duplicate is refused by the guard, so the earliest timestamp wins without any comparison. |
| Change here | Only *when* the first `start` is written. The entry shape, kinds and guards are untouched. |

### State transition affected

```
dispatch ──▶ [step-start part stamps `start`] ──▶ before-hooks ──▶ nodes ──▶ `complete`
```

Today the stamp sits after the before-hooks and, in `plan`, after the first node as well, so the bracketed box moves left. The `complete` end of the window is already trustworthy and does not move.
