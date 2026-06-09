---
description: "Companion lean implement — execute tasks.md in dependency order (per-spec opt-in)"
---

## User Input

```text
$ARGUMENTS
```

## Outline

1. Read `.specify/feature.json` for the feature directory; load `<feature_directory>/tasks.md`, `plan.md`, and `spec.md`. Then record the **implement START** so the step's duration begins now (the script stamps the real clock; the end-of-step hook records each task and closes the step — do not hand-write implement timing):
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step implement --status implementing --kind start --by extension
   ```

2. Execute tasks in dependency order:
   - Complete each layer before the next: Setup → Foundational → Core → Integration → Polish.
   - Tasks marked `[P]` (different files, no incomplete dependency) may run together; tasks touching the same file run sequentially.
   - Halt on a failed non-parallel task and report the cause; for `[P]` tasks, continue the others and report the failure.

3. After completing a task, mark it `- [x]` in `tasks.md`.

4. On completion, validate the result against the spec's **Functional Requirements** and **Success Criteria**, and report a short summary of what was built and anything left undone.

**Output**: working changes per `tasks.md`, with completed tasks checked off.


<!-- speckit-companion:timing -->
## Timing — keep `.spec-context.json` honest

These rules apply to every Companion profile command. The extension records lifecycle timing with its own scripts wherever it can; these rules keep anything you append consistent with that and accurate for any dispatcher (terminal, IDE chat, or the GUI).

- **Live timestamps.** When you append a history entry yourself, stamp it by running `date -u +"%Y-%m-%dT%H:%M:%SZ"` at that moment. Never hand-type a timestamp, never reuse an earlier value, never stamp several entries with one shared value.
- **Self-close — but not specify or implement.** When your own work for **plan, tasks, clarify, or analyze** ends, append `{ "step": "<this step>", "substep": null, "kind": "complete", "by": "ai", "at": "<date -u output>" }`. Do NOT self-close **specify** or **implement**: the extension closes those itself (specify from its own command, implement from the end-of-step hook), so an `ai` complete there would duplicate it.
- **Substeps live.** For each substep boundary, append its own entry with that substep name and its own fresh `date -u` the moment it finishes — not batched at the end.
- **Implement: do not journal timing.** Just mark each task `- [x] **<TaskID>**` in `tasks.md` as you finish it and append `task_summaries.<TaskID>`. The end-of-step hook records every task's start + complete and the implement step's end — leave all implement timing to it.
- **Never write the next step's start.** Only the next command appends the next step's start entry; writing it here makes the viewer render a phantom "Generating <next>…".
<!-- /speckit-companion:timing -->
