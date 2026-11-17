# Implementation Plan: The run record keeps its promises

## Summary

Two small guards in the record writer and one property test file. In `write-context.py`, where a same-step write assigns `status`, refuse a status that ranks earlier in `STATUS_ORDER` than the current one and say so on stderr. In `spec_context.py`'s `read_ctx`, when the process is a writer (the write lock is enabled) and the file exists but is not a JSON object, copy its bytes to `.spec-context.damaged-<time>.json` beside it and warn before returning `{}`; readers that never enable the lock leave the file alone. The property tests start from the pdd-lite seed, rewritten as stdlib `unittest` cases using Hypothesis, drive the real script by subprocess, skip when Hypothesis is missing, and run in a new CI step that installs a pinned Hypothesis.

## Key Decisions

- **Refuse only the status, not the whole write.** A late start still belongs in the history; only the backward status move is wrong. Rejected: refusing the write, which would drop a real event.
- **Keep aside in `read_ctx`, writers only.** That is the one place every writer reads before publishing, and the lock flag already tells a writer from a reader. Rejected: doing it in `_guard_append_only`, which runs after the fresh record is built and would duplicate the parse.
- **A timestamped copy, never a rename.** The copy is what a person recovers from; the writer then publishes over the original as before, under the same lock.
- **Slow lane is a CI step, not a marker.** CI's capture suite is stdlib only. The property file skips without Hypothesis, and a separate step installs `hypothesis==6.112.2` and runs it with `COMPANION_SLOW=1`. Example counts are cut so the file takes about a minute.

## Files

- `apps/speckit-extension/scripts/spec_context.py`: `status_moves_back()`, damaged-record copy in `read_ctx`.
- `apps/speckit-extension/scripts/write-context.py`: use `status_moves_back()` before assigning status.
- `apps/speckit-extension/tests/test_record_guards.py`: unit tests for r8 and r9.
- `apps/speckit-extension/tests/test_record_properties.py`: the property tests.
- `.github/workflows/ci.yml`: the slow-lane step.
- `apps/speckit-extension/CHANGELOG.md`: fold into the run-record line.
