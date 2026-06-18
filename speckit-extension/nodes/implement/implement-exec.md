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

2. Work `tasks.md` **phase by phase, in dependency order**: **Setup**, then **Foundational** (which blocks every story), then each **user-story** phase in priority order (P1 first), then **Polish**. `tasks.md` lays each phase out as ordered **waves** separated by `**⟶ Wait …**` join lines. The waves are a **dependency map**: tasks inside one wave are independent of each other (any order is safe), and a `⟶ Wait` line marks where the next tasks depend on everything above it. **Execute wave by wave, in order, and stop at each `⟶ Wait` line until the wave above is done** before starting the next. Halt on a failed task and report the cause.

3. **Build a wave's tasks yourself, in turn — inline is the default.** Implement each task in the wave directly (write its file), in any order within the wave since they're independent. As you finish each task, **append its finish** to the event log — that single append is the closing action of the task, done the moment its work is complete:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --task <TaskID> --kind complete --by ai --did "<one line>" --files "<files>" --append
   ```
   `--append` is one no-read write, so it never stalls and never corrupts the shared context. Do **not** hand-edit the `tasks.md` checkbox — the materialize step below checks it off from your appended finish.
   - *Optional parallelism:* if your host has a subagent/`Task` tool **and** a wave's tasks are each substantial enough that a separate worker would pay for its own startup, you may dispatch one subagent per task instead — each makes only its task's edits and appends its own finish. For the common case (small files, quick edits) this overhead does **not** pay off, so inline is both the default and usually the faster choice. Either way the result is identical.

4. **After each wave, reconcile and materialize, then cross the join line.** Type-check/build the wave's files together and fix any seam drift. Then fold the wave with one call — it updates the panel **and** checks off the `tasks.md` boxes for every appended finish:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --materialize
   ```
   `tasks.md` is owned only through this `--materialize` call (the script flips the boxes), so it never diverges from the journal. Now move past the `⟶ Wait` line to the next wave.

5. On completion, validate the result against the spec's **Functional Requirements** and **Success Criteria**, and report a short summary of what was built and anything left undone.

**Output**: working changes per `tasks.md`, with completed tasks checked off.
