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

<!-- speckit-companion:part least-code -->

<!-- /speckit-companion:part least-code -->

3. **Hand each user-story phase to a worker where your host has one; build everything else yourself.** Setup, Foundational and Polish stay with you — Setup is trivial, Foundational blocks every story, Polish is cross-cutting. A **story phase** is the unit worth handing off, because it is minutes of work and pages of reading, and every file you open is context you then carry for the rest of the run: on one measured run, reading was 87% of everything the implementing agent took in. Never fan out per *task* — a task is seconds of work against a comparable startup, so it saves nothing and it was tried.

   **Only dispatch story phases whose files are disjoint.** Every task line names its exact file, so compare the file names across the phases before dispatching: two phases naming the same file are not independent whatever the story numbering says, and those run one after another in priority order. Give each worker its phase's task lines, that user story from `spec.md`, and the plan's Structure Decision — then ask it to read what it needs, write the code **and that story's tests**, run the suite, and return only a distilled result: what it built, the files it touched, and any test still failing. A worker that returns file contents has defeated the point.

   ```bash
   # the worker, per task it finishes — append only, never fold
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --task <TaskID> --kind complete --by ai --did "<one line>" --files "<files>" --append
   # you, the moment each worker's result returns
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --materialize
   ```

   Folding is a read-modify-write on the shared file and two folders is the race the append log exists to prevent, so **workers only ever append and you do every fold**, in the foreground, one at a time.

4. **Without a worker, build the waves yourself, and close each task as you finish it** — the moment its work is done, never batched at the end of a wave:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --close-task <TaskID> --by ai --did "<one line>" --files "<files>"
   ```
   `--close-task` appends the finish and folds it in one call: the panel updates and the task's `tasks.md` box is checked (never hand-edit the checkbox). It is the main agent closing its own task, which is why the two halves can be one call. The result is identical to the fanned-out path; only what you had to read to get there differs.

5. **At each join line, reconcile before crossing it.** Type-check or build the phase's files together and fix any seam drift — a worker that changed an interface another assumed is exactly what this catches — then run `--materialize` once more as a backstop. It is idempotent, so re-folding never double-counts, and it catches any finish whose fold was missed. `tasks.md` is owned only through `--materialize`, so it never diverges from the journal.

6. **Run the project's own checks before you call this done.** Validating against the spec's **Functional Requirements** and **Success Criteria** by reading is not validation — a test you wrote and never executed is a guess about your own code. Run the suite and the type-check/build the project actually uses (read them from its `package.json` scripts, `Makefile`, or the repo's own instructions; do not invent a command).

   - **A test you authored that fails is your task, not a follow-up.** Fix it now. Shipping a red suite is a defect the run introduced, and it is the single most common way a finished-looking run is not finished.
   - **A pre-existing test your change invalidated is also yours.** Renaming what a component shows breaks the test asserting the old text; updating it is part of the change, not scope creep.
   - **A test file that does not compile counts as failing.** Check the suite actually ran, not merely that the command exited.
   - **If you genuinely cannot run them** — no test script exists, or the environment forbids it — say so explicitly in the summary and record it as a concern below. Do not describe a read-through as though it were a run.

   **Then read your own diff once more and ask what can be deleted.** A helper with one caller, a branch no input reaches, a wrapper that only forwards, a test asserting what the type already guarantees. Deleting it now costs nothing; deleting it in six months costs an argument.

   Then report a short summary of what was built and anything left undone.

7. **Capture what was verified and decided** — the audit trail a resume/handoff needs, recorded the moment validation ends (best-effort; JSON when you can, bare text when not; skip silently if `python3` is unavailable):
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step implement --batch '{
     "verified":   [{"what": "<check>", "command": "<cmd>", "result": "<outcome>", "warnings": ["<seen-and-dismissed>"]}],
     "decisions":  [{"decision": "<implementation choice>", "why": "<why>", "rejected": "<alternative>"}],
     "concerns":   [{"note": "<friction, residual risk, or a `// simplified:` ceiling you left in the code>", "step": "implement"}],
     "coverage":   [{"req": "FR-001", "tests": "<path.test.ts::case,other.test.ts>"}],
     "step_summary": {"summary": "<what shipped in one line>"},
     "last_action": "<final breadcrumb, e.g. all tasks done — 18/18 tests pass>"
   }'
   ```

   **One call, not one per item.** `--batch` takes the whole volley as a single JSON object and applies each writer additively, so the shared context file is read and rewritten once instead of once per entry. A volley issued one flag at a time rewrote 617KB to carry 7KB on one measured run — 89x — and every call is a separate round-trip in your context. Emit one `--batch`. Include only the keys you actually have — an empty list is not the same as an absent one, and on a clean run `concerns` is genuinely absent.
   The `--verified` entries are where "did it actually run" is settled, so record the command you ran and its real outcome — `"result": "142/142 pass"` — never a restatement of intent. If a check could not be run, record that as a `--concern` naming what was skipped and why, and do **not** record a `--verified` for it: a verification entry for a check that never happened is worse than no entry, because every later reader trusts it.

   One `--verified` per real check (tests, build, manual pass — include warnings you saw and judged benign), one `--coverage-req … --tests …` per requirement a test covers, one `--decision` per genuine implementation choice. Record `--concern` only for real friction — on a clean run record none (the empty list is itself the signal). All additive and de-duped; re-runs never duplicate.

**Output**: working changes per `tasks.md`, with completed tasks checked off.
