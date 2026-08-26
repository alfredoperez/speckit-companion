# Contract: capture CLI additions

Two additions to `write-context.py`. Both are strictly additive — every existing flag keeps its exact behavior, and the record either produces is byte-identical to what the current call sequence produces.

## `--batch <json>` — the end-of-step volley in one call

```
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <dir> --batch '{
  "verified":  [{"what": "…", "result": "…"}],
  "decisions": [{"decision": "…", "why": "…", "rejected": "…"}],
  "concerns":  [{"note": "…", "step": "implement"}],
  "coverage":  [{"req": "FR-001", "tasks": ["T003"], "tests": ["tests/test_doctor.py::test_x"]}],
  "step_summary": {"step": "implement", "summary": "…", "key_finding": "…"},
  "last_action": "…"
}'
```

- Every key is optional; an absent key writes nothing for that slot.
- Applied through the existing additive-capture writers with the same de-duplication rules each writer already has. It collapses the volley to **one invocation**; each writer still performs its own atomic write, so the call count drops and the rewrite count does not.
- `step_summary.step` selects which slot to write and is not stored in the record, so the entry is byte-identical to what `--step-summary` writes.
- A malformed document is a caller error: nothing is written and the exit code is `2`, matching how `--classification` already treats a bad payload.
- Mixing `--batch` with a lifecycle flag follows the existing rule — the capture is applied and the skipped lifecycle write is named on stderr.

## `--close-task` — the single-call task close

```
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <dir> \
  --close-task T007 --did "<one-line summary>" --files "<comma,separated>"
```

Equivalent to today's `--task T007 --kind complete --append` followed by `--materialize`, in one invocation.

**Rules**

- Reserved for the main agent. A fanned-out worker MUST still use `--task … --append` alone, because `--close-task` folds, and two folders on the shared record is exactly the contention the split existed to prevent. The command bodies say so explicitly and the flag's help text repeats it.
- `--append` and `--materialize` keep working unchanged; nothing is deprecated.
- Idempotent: re-running `--close-task` for the same task never double-counts, inheriting the fold's existing idempotence.
