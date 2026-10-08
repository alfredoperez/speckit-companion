# Research: Sizing and unverified guards

## Where the sizing rule goes, under the instruction ceiling

**Decision**: the question rides on existing lines. In `sizing.md` the `small` bullet gains a continuation: it is small only when it is also easy to undo and easy to check. In `classify-size.md` the verdict pseudo-code gains `and not riskyToShip`, defined in the same fence, and the reason line is a second fenced line under the existing Guardrail warning bullet. No new bullet and no new bolded lead anywhere.

**Rationale**: the specify command sits at exactly 69 directives, the hard ceiling CI enforces with `instruction-budget.py --strict`. A new bullet fails the build. Continuation lines and fenced text are not counted.

**Alternatives considered**: a fourth bullet in the part (one over the ceiling); a new node (more directives, more ceremony).

## Which line prints when both conditions hold

**Decision**: one line, never two. A change over the 5 file or 10 task bar prints the existing guardrail line. A change inside the bar that is hard to undo or hard to check prints `[companion] Change is hard to undo or hard to check — running the full pipeline as <normal|oversized>.` A wording signal such as "redesign" keeps printing the guardrail line, as before: the new line claims a risk, and a wording signal alone is not one.

**Rationale**: the old line misdescribed a three-file migration. The run log should say the true reason.

## Whether the standalone classify command prints the reason

**Decision**: no. It keeps printing exactly one `size=` line, which a workflow switch reads. It gets the rule through the shared part, so its verdict changes; its output shape does not.

**Rationale**: a second line would break the "print exactly one line" contract a router depends on.

## Whether the reason is recorded

**Decision**: not recorded. The printed line is the requirement. The classification record keeps its four fields.

**Rationale**: `scopeSignal` is an enum in the schema and the TypeScript type; a new value or key means a schema change for a line the run log already carries.

**Alternatives considered**: a `risk` key on the classification (a schema and viewer change for no reader).

## How completion adds the concern

**Decision**: inside `mark_spec_complete`, after both refusal guards and after the record is re-read, add the concern to the in-memory record and let the function's single write publish it with the status. The entry is `{"note": "finished, unverified", "step": "implement"}`. Nothing verified means `verified` is not a non-empty list, the doctor's own test. Explained means the top-level `concerns` holds anything at all, whatever its shape, so a hand-written explanation is never replaced. The warning is one `[companion] Warning:` line on stderr, and the function still returns the target.

**Rationale**: the existing capture helper does its own read and write, so calling it before the final write would be overwritten and calling it after makes two publishes. Capture flags cannot ride on the same CLI call as `--mark-complete`, so the script has to write it.

**Alternatives considered**: `append_capture_entries` after the final write (two publishes of a finished record); a `--concern` on the same call (dropped by the dispatcher).

## What the guard does not cover, on purpose

**Decision**: three things stay as they are and are named in the spec's assumptions. The Mark Completed button in VS Code is a person closing a spec by hand and writes no concern. A failed check still counts as a verification, because it is in the record and reads as failed. A per-task concern does not count as an explanation; only a top-level one does. The doctor keeps reporting an unverified run as a problem: it audits, this warns.

**Rationale**: each is a separate behaviour with its own readers. Widening this change to them is a design call nobody asked for.

## One branch resolver for the sidebar and the viewer

**Decision**: `resolveSpecBranch(ctx)` returns the first non-blank string of `workingBranch`, then `branch`, else nothing. The sidebar tooltip and both viewer reads call it.

**Rationale**: the viewer already prefers the working branch. A sidebar that read only `branch` would show `main` beside a viewer showing the feature branch for the same spec. Two paths to one fact drift.

**Alternatives considered**: reading `branch` only in the sidebar (disagrees with the viewer, and is wrong for this very spec).

## Making the recorded branch the one the work is on

**Decision**: a step start records `workingBranch` when the checked-out branch is known, is a named branch, and differs from the recorded `branch`.

**Rationale**: `branch` is frozen at the first write, which lands before the feature branch exists, so 10 of the last 25 specs record `main`. Nothing wrote `workingBranch`, so the viewer header and the new tooltip would both name the wrong branch. Step starts are the four writes a pipeline run always makes on its feature branch.

**Alternatives considered**: rewording the tooltip to "created on" (true and useless); correcting `branch` itself (it is the audit trail of where the spec was created).
