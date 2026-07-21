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

3. **Build a wave's tasks yourself, in turn — inline is the default.** Implement each task in the wave directly (write its file), in any order within the wave since they're independent. Closing a task is **two calls, run back to back the moment its work is complete**: append its finish, then fold it so the panel and `tasks.md` advance now — not at the end of the wave:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --task <TaskID> --kind complete --by ai --did "<one line>" --files "<files>" --append
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --materialize
   ```
   `--append` is one no-read write, so it never stalls and never corrupts the shared context; `--materialize` is the one read-modify-write that folds the finish into `.spec-context.json` **and** checks off the task's `tasks.md` box (never hand-edit the checkbox). Only the folded finish is visible to the panel, which is why the fold runs per task. **You — the MAIN agent — are the only one who runs `--materialize`**: foreground, one task at a time.
   - *Optional parallelism:* if your host has a subagent/`Task` tool **and** a wave's tasks are each substantial enough that a separate worker would pay for its own startup, you may dispatch one subagent per task instead — each makes only its task's edits and **appends its own finish, nothing more** (workers never materialize; two writers on the shared file is the race the append log exists to prevent). As each worker's result returns, run `--materialize` yourself so that task lands in the panel immediately. For the common case (small files, quick edits) the overhead does **not** pay off, so inline is both the default and usually the faster choice. Either way the result is identical.

4. **After each wave, reconcile, then cross the join line.** Type-check/build the wave's files together and fix any seam drift, then run `--materialize` once more as a backstop — it is idempotent, so re-folding never double-counts, and it catches any finish whose fold was missed. `tasks.md` is owned only through `--materialize` (the script flips the boxes), so it never diverges from the journal. Now move past the `⟶ Wait` line to the next wave.

5. On completion, validate the result against the spec's **Functional Requirements** and **Success Criteria**, and report a short summary of what was built and anything left undone.

6. **Capture what was verified and decided** — the audit trail a resume/handoff needs, recorded the moment validation ends (best-effort; JSON when you can, bare text when not; skip silently if `python3` is unavailable):
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --verified '{"what": "<check>", "command": "<cmd>", "result": "<outcome>", "warnings": ["<seen-and-dismissed>"]}'
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --decision '{"decision": "<implementation choice>", "why": "<why>", "rejected": "<alternative>"}'
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --concern '{"note": "<friction/workaround/residual risk>", "step": "implement"}'
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --coverage-req FR-001 --tests "<path.test.ts::case,other.test.ts>"
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step implement --step-summary '{"summary": "<what shipped in one line>"}'
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --set last_action="<final breadcrumb, e.g. 'all tasks done — 18/18 tests pass'>"
   ```
   One `--verified` per real check (tests, build, manual pass — include warnings you saw and judged benign), one `--coverage-req … --tests …` per requirement a test covers, one `--decision` per genuine implementation choice. Record `--concern` only for real friction — on a clean run record none (the empty list is itself the signal). All additive and de-duped; re-runs never duplicate.

**Output**: working changes per `tasks.md`, with completed tasks checked off.
