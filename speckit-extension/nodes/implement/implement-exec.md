---
id: implement-exec
kind: author
command: implement
writes: tasks.md
reads: []
---
1. Read `.specify/feature.json` for the feature directory; load `<feature_directory>/tasks.md`, `plan.md`, and `spec.md` (and `data-model.md` / `contracts/` if present). Then record the **implement START** so the step's duration begins now (the script stamps the real clock; do not hand-write implement timing):
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step implement --status implementing --kind start --by extension
   ```

2. Work `tasks.md` **phase by phase, in dependency order**: **Setup**, then **Foundational** (which blocks every story), then each **user-story** phase in priority order (P1 first), then **Polish**. Within a story, write any tests first and confirm they fail before implementing; then go models → services → UI → integration. Halt on a failed task and report the cause.

3. **Inside each phase, FAN OUT — build the independent (`[P]`) tasks in parallel with subagents. This is the default, not an optimization.** Look at the phase's `[P]` tasks (different files, no incomplete dependency): that set is a batch, and you build the **whole batch at once** by **spawning one subagent (the Task tool) per task — all in a single message** so they run concurrently. Do not implement `[P]` tasks one-by-one yourself; that is the slow fallback for a host with no subagents, and it should be your last resort, not your habit. Each subagent's brief is tight:
   - It makes **only its own task's edits** (the one file the task names), touches nothing else, and returns a one-line summary.
   - When its work is done, it **appends its own finish** to the event log as the closing action of the task — nothing more:
     ```bash
     python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --task <TaskID> --kind complete --by ai --did "<one line>" --files "<files>" --append
     ```
     `--append` is a single no-read write, so every subagent can append at the same time without contending. The subagent does **not** edit `tasks.md` and does **not** touch `.spec-context.json` — the script checks the box later.
   - If the batch's tasks share an interface (a contract pinned in `tasks.md`/`contracts/`), paste that contract into each subagent's brief verbatim so they don't drift.
   Same-file or dependent tasks are **not** `[P]` — keep those ordered (never in one batch).

4. **After a batch returns, reconcile and materialize (main agent).** Type-check/build the files the subagents wrote side by side and fix any seam drift. Then fold the batch with one call — it both updates the panel and checks off the `tasks.md` boxes for every appended finish:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --materialize
   ```
   You (the main agent) own `tasks.md` only through this `--materialize` call; no subagent edits it, so there is no shared-file race. Move to the next phase.

5. On completion, validate the result against the spec's **Functional Requirements** and **Success Criteria**, and report a short summary of what was built and anything left undone.

**Output**: working changes per `tasks.md`, with completed tasks checked off.
