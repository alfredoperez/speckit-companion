# Contract: converge finish and mark-complete

`write-context.py --hook finish --step converge` records converge's finish in `.spec-context.json`, as it does for any step.

After recording, it marks the spec completed, written `by: extension` through `mark_spec_complete`, only when all of these hold: the status is `implemented`, every task in `tasks.md` is checked, and `tasks.md` was not modified after converge's start.

If any condition fails, the spec keeps its status. That covers a converge that appended tasks, a spec still implementing, a spec already completed, a converge with no recorded start, and a missing task list. The hook never fails the run for these cases.

`write-context.py --mark-complete` stays the manual command. The one-line mark-complete page runs it, and it keeps its current behavior on an implemented spec.
