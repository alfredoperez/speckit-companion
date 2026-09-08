---
id: implement-exec
name: Execute the tasks
kind: author
command: implement
writes: tasks.md
reads: []
---
1. Read `.specify/feature.json` for the feature directory. Load `<feature_directory>/tasks.md`, `plan.md`, and the feature spec (`<short-name>.spec.md`, or `spec.md` in a project written before this), plus `data-model.md` and `contracts/` if present. The step's start is already stamped, above.

2. Work `tasks.md` **phase by phase, in dependency order**: **Setup**, then **Foundational** (which blocks every story), then each **user-story** phase in priority order (P1 first), then **Polish**. `tasks.md` lays each phase out as ordered **waves** separated by `**⟶ Wait …**` join lines. The waves are a **dependency map**: tasks inside one wave are independent of each other, so any order is safe, and a `⟶ Wait` line marks where the next tasks depend on everything above it. **Execute wave by wave, in order, and stop at each `⟶ Wait` line until the wave above is done.** Halt on a failed task and report the cause.

3. **Dispatch one worker per user-story phase. If you have a subagent tool, Claude Code's `Agent`/`Task` tool or your host's equivalent, you use it here. This is an instruction, not an option, and not a judgement about how big the phase is.** Setup, Foundational and Polish stay with you: Setup is trivial, Foundational blocks every story, Polish is cross-cutting. A thin phase is still dispatched; the saving is every file you never open, not the minutes. A story phase is minutes of work and pages of reading, and every file you open is context you carry to the end of the run. Never fan out per *task*: the startup costs more than the task.

   **One test decides it, and it is not about the phase: did specify, plan and tasks already run in this same session?** If they did not, dispatch every story phase, always. Nothing you opened while orienting counts: reading `tasks.md`, `plan.md`, the spec, or a couple of source files to fix your conventions is not the same as carrying a phase, and a phase whose files you have *partly* seen is still dispatched. Only when the whole pipeline ran in front of you in this session is the reading genuinely spent, and then you build inline and say so. Never decide this per phase on a hunch about what you happen to have open.

   **Read each story phase's files line, `Files:` or `Files owned by this phase:`. That is its ownership.** The tasks step gave every file one owner, so the story phases are disjoint by construction and you dispatch them all together. Two phases naming the same file is a defect in the task list: say so in your summary, and run those two one after another rather than together. Give each worker its phase's task lines, that user story from `spec.md`, the plan's Structure Decision, and **its own living-spec slice**, `resolve-spec-paths.py --changed <that phase's files> --requirements-for --json`, so it carries the requirements about the files it touches and none of yours. Then ask it to read what it needs, write the code **and that story's tests**, run **only the test files its phase owns** (the full suite runs once, at the end), and return a distilled result only: what it built, the files it touched, and any test still failing. A worker must never return file contents.

   ```bash
   # the worker, per task it finishes: append only, never fold
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --task <TaskID> --kind complete --by ai --did "<one line>" --files "<files>" --append
   # you, the moment each worker's result returns
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --materialize
   ```

   Folding is a read-modify-write on the shared file, so two folders at once race. **Workers only ever append, and you do every fold**, in the foreground, one at a time.

4. **Only when you have no subagent tool at all, build the waves yourself, and close each task as you finish it**, the moment its work is done, never batched at the end of a wave:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --close-task <TaskID> --by ai --did "<one line>" --files "<files>"
   ```
   `--close-task` appends the finish and folds it in one call: the panel updates and the task's `tasks.md` box is checked. Never hand-edit the checkbox. This path is for hosts that cannot dispatch, not a choice.

5. **At each join line, check the workers' claims before crossing it.** A worker's report names files it touched and tests it ran; confirm the files exist and the test files are on disk before its result becomes the next phase's input. A claim that does not check out gets one re-run with the specific correction, and a second failure stops the step rather than building on it.

   Then reconcile. Hand the type-check and the lint to one worker and take back only the verdict and the failing names. Fix any seam drift, such as a worker that changed an interface another assumed. Then run `--materialize` once more as a backstop: it is idempotent, and it catches any finish whose fold was missed. `tasks.md` is owned only through `--materialize`.

6. **Run the project's own checks before you call this done.** Validating against the spec's **Functional Requirements** and **Success Criteria** by reading is not validation. Run the suite and the type-check or build the project actually uses, read from its `package.json` scripts, `Makefile`, or the repo's own instructions, and do not invent a command: a test you wrote and never executed is a guess about your own code.

   - **A test you authored that fails is your task, not a follow-up.** Fix it now.
   - **A pre-existing test your change invalidated is also yours.** Renaming what a component shows breaks the test asserting the old text. Updating it is part of the change, not scope creep.
   - **A test file that does not compile counts as failing.** Check the suite actually ran, not merely that the command exited.
   - **If you genuinely cannot run them**, because no test script exists or the environment forbids it, say so explicitly in the summary and record it as a concern below. Do not describe a read-through as though it were a run.

   **Then read your own diff and delete what it does not need**: a helper with one caller, a branch no input reaches, a wrapper that only forwards. Then report a short summary of what was built and anything left undone.

7. **Capture what was verified and decided** the moment validation ends (best-effort; JSON when you can, bare text when not; skip silently if `python3` is unavailable):
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step implement --batch '{
     "verified":   [{"what": "<check>", "command": "<cmd>", "result": "<outcome>", "warnings": ["<seen-and-dismissed>"]}],
     "decisions":  [{"decision": "<implementation choice>", "why": "<why>", "rejected": "<alternative>"}],
     "concerns":   [{"note": "<friction, residual risk, or a `// simplified:` ceiling you left in the code>", "step": "implement"}],
     "coverage":   [{"req": "FR-001", "tests": "<path.test.ts::case,other.test.ts>"}],
     "step_summary": {"summary": "<what shipped in one line>"},
     "last_action": "<final breadcrumb, e.g. all tasks done, 18/18 tests pass>"
   }'
   ```

   **One call, not one per item.** `--batch` takes the whole volley as a single JSON object and applies each writer additively, so the shared context file is read and rewritten once instead of once per entry. Emit one `--batch`. Include only the keys you actually have: an empty list is not the same as an absent one, and on a clean run `concerns` is genuinely absent.

   In `--verified`, record the command you ran and its real outcome, `"result": "142/142 pass"`, never a restatement of intent. If a check could not be run, record that as a `--concern` naming what was skipped and why, and do **not** record a `--verified` for it.

   One `--verified` per real check (tests, build, manual pass, including warnings you saw and judged benign), one `--coverage-req … --tests …` per requirement a test covers, one `--decision` per genuine implementation choice. Record `--concern` only for real friction; on a clean run record none.

**Output**: working changes per `tasks.md`, with completed tasks checked off.
