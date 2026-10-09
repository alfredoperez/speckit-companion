# Data Model: Sizing and unverified guards

No new record type and no schema change. One judgement joins the sizing inputs, one concern entry is written by completion, and one read order is shared by the sidebar and the viewer.

## Sizing verdict inputs

| Input | Type | Recorded | Rule |
|---|---|---|---|
| `projectedFiles` | number | yes | inside the small bar at 5 or fewer |
| `projectedTasks` | number | yes | inside the small bar at 10 or fewer |
| `scopeSignal` | `"larger"`, `"smaller"`, `"none"` | yes | read from the spec's wording |
| `riskyToShip` | yes or no | no | the agent's judgement that the change is hard to undo or hard to check; an unclear case counts as yes |

The classification record keeps its four fields. `riskyToShip` lives only in the verdict rule and in the printed reason line, so the `scopeSignal` enum is unchanged.

| Inside the small bar | `scopeSignal` | `riskyToShip` | Verdict | Line printed |
|---|---|---|---|---|
| yes | not `"larger"` | no | `simple` | none |
| yes | not `"larger"` | yes | `normal` | hard to undo or hard to check |
| yes | `"larger"` | either | `normal` | hard to undo or hard to check |
| no, under double | any | either | `normal` | the existing guardrail line |
| no, more than 10 files or 20 tasks, or several subsystems | any | either | `oversized` | the existing guardrail line |

Exactly 5 files or 10 tasks is still inside the bar. One line is printed at most. The standalone classify command gets the same verdict and keeps printing only its `size=` line.

## The unverified concern

Entry appended to the top-level `concerns` list of `.spec-context.json`: `{"note": "finished, unverified", "step": "implement"}`.

| Field | Value | Rule |
|---|---|---|
| `note` | `finished, unverified` | verbatim |
| `step` | `implement` | fixed |

Completion adds the entry when both hold: `verified` is not a non-empty list, and top-level `concerns` holds nothing (any value that holds something, of any shape, counts as an explanation and is left as it was). A value that is present but not a list counts as empty. A failed check in `verified` still counts as a verification. A concern noted on a single task does not count as an explanation.

The entry is added once: after the first completion `concerns` is non-empty, and a spec already completed or archived is untouched. It rides on the same single write that sets the status, with one `[companion] Warning:` line on stderr.

State transition: `implemented` to `completed`, with or without the entry. Completion never refuses for lack of verification. A person pressing Mark Completed in VS Code writes no concern.

## Branch resolution order

`resolveSpecBranch(ctx)` reads two existing fields and returns the first that is a non-blank string.

| Order | Field | Used when |
|---|---|---|
| 1 | `workingBranch` | it is a non-blank string |
| 2 | `branch` | `workingBranch` is missing, blank, or not text |
| 3 | none | neither qualifies, so the tooltip has no Branch line |

The sidebar tooltip renders `Branch: <name>` from the result, and both viewer reads call the same helper, so the two always agree.
