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

2. Work `tasks.md` **phase by phase, in dependency order**: **Setup**, then **Foundational** (which blocks every story), then each **user-story** phase in priority order (P1 first), then **Polish**. `tasks.md` lays each phase out as ordered **waves** (`**Wave N — parallel …**` blocks separated by `**⟶ Wait …**` join lines) — execute it wave by wave, in order, and **stop at each `⟶ Wait` line until the wave above is done** before starting the next. Halt on a failed task and report the cause.

3. **A wave is built all at once — fan out one subagent per task. This is how you execute a wave, not an optional speed-up.** For each `**Wave N — parallel …**` block, **spawn one subagent (the Task tool) per task in that wave, all in a single message,** so the whole wave runs concurrently. Doing a wave's tasks one-by-one yourself is the fallback *only* when your host has no subagent tool — it is not the normal path. A wave of one is just a single task. Each subagent's brief is tight:
   - It makes **only its own task's edits** (the one file the task names), touches nothing else, and returns a one-line summary.
   - When its work is done, it **appends its own finish** to the event log as the closing action of the task — nothing more:
     ```bash
     python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --task <TaskID> --kind complete --by ai --did "<one line>" --files "<files>" --append
     ```
     `--append` is a single no-read write, so every subagent in the wave can append at the same time without contending. The subagent does **not** edit `tasks.md` and does **not** touch `.spec-context.json` — the script checks the box later.
   - If a wave's tasks share an interface (a contract pinned in `tasks.md`/`contracts/`), paste that contract into each subagent's brief verbatim so they don't drift.

4. **When the wave returns, reconcile and materialize (main agent), then cross the join line.** Type-check/build the files the wave wrote side by side and fix any seam drift. Then fold the wave with one call — it both updates the panel and checks off the `tasks.md` boxes for every appended finish:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --materialize
   ```
   You (the main agent) own `tasks.md` only through this `--materialize` call; no subagent edits it, so there is no shared-file race. Now move past the `⟶ Wait` line to the next wave.

5. On completion, validate the result against the spec's **Functional Requirements** and **Success Criteria**, and report a short summary of what was built and anything left undone.

**Output**: working changes per `tasks.md`, with completed tasks checked off.
