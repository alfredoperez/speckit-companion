# Data Model: Converge completes the spec

No new stored fields. The feature reshapes one transition and one check on existing records.

## Spec status (`.spec-context.json` `status`)

The existing field. `implemented` moves to `completed` when a converge run closes clean. `completed` is written only by `mark_spec_complete(feature_dir, "extension")`, so the history entry carries `by: extension`. A status never moves backward, so a spec already `completed` is left alone, and any status other than `implemented` is not touched by this path.

## Clean-converge window

A derived check, not stored. Converge's start time comes from the converge step's `startedAt` in the record, and the file time is the mtime of `tasks.md`. The window is clean when the mtime is not later than the start, meaning converge appended no new tasks. It also requires every task checked. If converge added work, `tasks.md` changes after the start, the window is dirty, and the spec stays `implemented` for implement to finish.

## Transition

`implemented` plus all tasks checked plus a clean window at converge finish gives `completed`. Any other combination leaves the status as it is.
