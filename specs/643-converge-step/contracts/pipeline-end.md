# Contract: how the Companion pipeline ends

## Implement stops at implemented

Companion implement ends with the spec at status implemented, never completed. Its `complete` node still does the living-spec accounting and fold, then closes the step with `write-context.py --step implement --advance --set workflow=companion`. Its handoff names `speckit.converge` as the next step.

## A clean converge completes the spec

`write-context.py --hook finish --step converge` completes a spec when the converge pass appended no task. This is already merged in #940 and behaves the same for manual, auto and stock runs. A pass that appended tasks leaves the spec at implemented, and implement runs again. A converge that stops before assessing leaves no finish record, so it never counts as clean.

## Converge on a completed spec is recorded

When the spec is already completed, a converge start or finish is accepted instead of refused. The run is recorded, status and current step stay as they are, and nothing moves backward. If converge appended tasks, the finish also adds a concern that names how many tasks are open. Every other write on a completed spec is still refused.

## Auto loops, with a cap

Auto runs converge after implement and repeats implement and converge until a pass appends nothing, at which point the spec is completed. After three passes it stops with the spec at implemented and records a concern naming the open tasks. The loop lives in the auto prompts.

## The workflow engine ends on converge

The workflow engine has no loop, so `speckit-companion.workflow.yml` replaces its terminal mark-complete step with a `speckit.converge` step. A clean converge there completes the spec through the same hook.

## Mark-complete stays as a manual command

`speckit.companion.mark-complete` remains available as the manual way to complete a spec. The pipeline no longer calls it as its final step.
