---
id: implement-exec
kind: author
command: implement
writes: tasks.md
reads: []
---
1. Read `.specify/feature.json` for the feature directory; load `<feature_directory>/tasks.md`, `plan.md`, and `spec.md`. Then record the **implement START** so the step's duration begins now (the script stamps the real clock; the end-of-step hook records each task and closes the step — do not hand-write implement timing):
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step implement --status implementing --kind start --by extension
   ```

2. Execute tasks in dependency order:
   - Complete each layer before the next: Setup → Foundational → Core → Integration → Polish.
   - If you support subagents, run each `[P]` batch (different files, no incomplete dependency) concurrently — one subagent per task. As each finishes, the main agent (never the subagents) records it one at a time, so writes to `.spec-context.json` stay foreground and never race (timing rules unchanged). Same-file or dependent tasks stay ordered. No subagent support → run `[P]` tasks sequentially. A project may route task types to specialist subagents via a hook (the agent-routing seam).
   - Halt on a failed non-parallel task and report the cause; for `[P]` tasks, continue the others and report the failure.

3. After completing a task, mark it `- [x]` in `tasks.md`.

4. On completion, validate the result against the spec's **Functional Requirements** and **Success Criteria**, and report a short summary of what was built and anything left undone.

**Output**: working changes per `tasks.md`, with completed tasks checked off.


