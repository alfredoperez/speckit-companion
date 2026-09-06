---
id: implement-exec
name: Execute the tasks
kind: author
command: implement
writes: tasks.md
reads: []
---
1. Read `.specify/feature.json` for the feature directory; load `<feature_directory>/tasks.md`, `plan.md`, and `spec.md` (and `data-model.md` / `contracts/` if present). The step's start is already stamped, above.

2. Work `tasks.md` **phase by phase, in dependency order**: **Setup**, then **Foundational** (which blocks every story), then each **user-story** phase in priority order (P1 first), then **Polish**. `tasks.md` lays each phase out as ordered **waves** separated by `**⟶ Wait …**` join lines. The waves are a **dependency map**: tasks inside one wave are independent of each other (any order is safe), and a `⟶ Wait` line marks where the next tasks depend on everything above it. **Execute wave by wave, in order, and stop at each `⟶ Wait` line until the wave above is done** before starting the next. Halt on a failed task and report the cause.

3. **Build a wave's tasks yourself, in turn — inline is the default.** Implement each task in the wave directly (write its file), in any order within the wave since they're independent. Closing a task is **one call, the moment its work is complete** — not at the end of the wave:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --close-task <TaskID> --by ai --did "<one line>" --files "<files>"
   ```
   `--close-task` appends the finish and folds it in one go: the panel updates and the task's `tasks.md` box is checked (never hand-edit the checkbox). The append carries its own real clock, so per-task timing is unchanged. This is the main agent closing its own task, which is why the two halves can be one call.
   - *A fanned-out worker still closes in two halves.* If your host has a subagent/`Task` tool **and** a wave's tasks are each substantial enough that a separate worker would pay for its own startup, you may dispatch one subagent per task instead. Each makes only its task's edits and **appends its own finish and nothing more** — `--task <TaskID> --kind complete --by ai --did … --files … --append`. Workers never fold: two writers on the shared file is the race the append log exists to prevent. As each result returns, you run `--materialize` yourself. For the common case (small files, quick edits) the overhead does **not** pay off, so inline is both the default and usually the faster choice. Either way the result is identical.

4. **After each wave, reconcile, then cross the join line.** Type-check/build the wave's files together and fix any seam drift, then run `--materialize` once more as a backstop — it is idempotent, so re-folding never double-counts, and it catches any finish whose fold was missed. `tasks.md` is owned only through `--materialize` (the script flips the boxes), so it never diverges from the journal. Now move past the `⟶ Wait` line to the next wave.

5. **Run the project's own checks before you call this done.** Validating against the spec's **Functional Requirements** and **Success Criteria** by reading is not validation — a test you wrote and never executed is a guess about your own code. Run the suite and the type-check/build the project actually uses (read them from its `package.json` scripts, `Makefile`, or the repo's own instructions; do not invent a command).

   - **A test you authored that fails is your task, not a follow-up.** Fix it now. Shipping a red suite is a defect the run introduced, and it is the single most common way a finished-looking run is not finished.
   - **A pre-existing test your change invalidated is also yours.** Renaming what a component shows breaks the test asserting the old text; updating it is part of the change, not scope creep.
   - **A test file that does not compile counts as failing.** Check the suite actually ran, not merely that the command exited.
   - **If you genuinely cannot run them** — no test script exists, or the environment forbids it — say so explicitly in the summary and record it as a concern below. Do not describe a read-through as though it were a run.

   Then report a short summary of what was built and anything left undone.

6. **Capture what was verified and decided** — the audit trail a resume/handoff needs, recorded the moment validation ends (best-effort; JSON when you can, bare text when not; skip silently if `python3` is unavailable):
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step implement --batch '{
     "verified":   [{"what": "<check>", "command": "<cmd>", "result": "<outcome>", "warnings": ["<seen-and-dismissed>"]}],
     "decisions":  [{"decision": "<implementation choice>", "why": "<why>", "rejected": "<alternative>"}],
     "concerns":   [{"note": "<friction/workaround/residual risk>", "step": "implement"}],
     "coverage":   [{"req": "FR-001", "tests": "<path.test.ts::case,other.test.ts>"}],
     "step_summary": {"summary": "<what shipped in one line>"},
     "last_action": "<final breadcrumb, e.g. all tasks done — 18/18 tests pass>"
   }'
   ```

   **One call, not one per item.** `--batch` takes the whole volley as a single JSON object and applies each writer additively, so the shared context file is read and rewritten once instead of once per entry. A volley issued one flag at a time rewrote 617KB to carry 7KB on one measured run — 89x — and every call is a separate round-trip in your context. Emit one `--batch`. Include only the keys you actually have — an empty list is not the same as an absent one, and on a clean run `concerns` is genuinely absent.
   The `--verified` entries are where "did it actually run" is settled, so record the command you ran and its real outcome — `"result": "142/142 pass"` — never a restatement of intent. If a check could not be run, record that as a `--concern` naming what was skipped and why, and do **not** record a `--verified` for it: a verification entry for a check that never happened is worse than no entry, because every later reader trusts it.

   One `--verified` per real check (tests, build, manual pass — include warnings you saw and judged benign), one `--coverage-req … --tests …` per requirement a test covers, one `--decision` per genuine implementation choice. Record `--concern` only for real friction — on a clean run record none (the empty list is itself the signal). All additive and de-duped; re-runs never duplicate.

**Output**: working changes per `tasks.md`, with completed tasks checked off.
