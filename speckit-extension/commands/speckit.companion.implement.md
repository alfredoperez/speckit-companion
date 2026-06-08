---
description: "Companion lean implement — execute tasks.md in dependency order (per-spec opt-in)"
---

## User Input

```text
$ARGUMENTS
```

## Outline

1. Read `.specify/feature.json` for the feature directory; load `<feature_directory>/tasks.md`, `plan.md`, and `spec.md`.

2. Execute tasks in dependency order:
   - Complete each layer before the next: Setup → Foundational → Core → Integration → Polish.
   - Tasks marked `[P]` (different files, no incomplete dependency) may run together; tasks touching the same file run sequentially.
   - Halt on a failed non-parallel task and report the cause; for `[P]` tasks, continue the others and report the failure.

3. After completing a task, mark it `- [x]` in `tasks.md`.

4. On completion, validate the result against the spec's **Functional Requirements** and **Success Criteria**, and report a short summary of what was built and anything left undone.

**Output**: working changes per `tasks.md`, with completed tasks checked off.


<!-- speckit-companion:timing -->
## Timing — keep `.spec-context.json` honest

These rules apply to every Companion profile command. They make per-step durations and per-task cadence accurate for any dispatcher (terminal, IDE chat, or the GUI), not just when the GUI prepends its preamble.

- **Live timestamps.** Obtain every timestamp by running `date -u +"%Y-%m-%dT%H:%M:%SZ"` at the moment the entry happens. Never hand-type a timestamp, never reuse an earlier value, and never stamp several entries with one shared value.
- **Self-close this step.** When *your own work for this step* ends, append a history entry `{ "step": "<this step>", "substep": null, "kind": "complete", "by": "ai", "at": "<date -u output>" }`. Do not rely on the next step to close this one — that is what corrupts specify's duration.
- **Substeps live.** For each substep boundary, append its own entry with that substep name and its own fresh `date -u` timestamp the moment it finishes — not batched at the end.
- **Implement: per task.** As you finish each task in `tasks.md` (the moment you mark its `- [x] **<TaskID>**`), append BOTH a start and a complete for it, each with its own `date -u`: `{ "step": "implement", "substep": "<TaskID>", "task": "<TaskID>", "kind": "start", "by": "ai", "at": "<date -u>" }` then the matching `"kind": "complete"`. One fresh `date -u` per task — do not batch; the per-task cadence is the point. The `task` field lets the end-of-step hook treat already-journaled tasks as a no-op.
- **Never write the next step's start.** Only the next command appends the next step's start entry; writing it here makes the viewer render a phantom "Generating <next>…".
<!-- /speckit-companion:timing -->
