---
id: implement-exec
name: Execute the tasks
kind: author
command: implement
writes: tasks.md
reads: []
---
1. Read `.specify/feature.json` for the feature directory. Load `<feature_directory>/tasks.md`, `plan.md`, and the feature spec (`spec.md`, or `<short-name>.spec.md` in a project written before this), plus `data-model.md` and `contracts/` if present. The step's start is already stamped, above.

2. Work `tasks.md` **phase by phase, in dependency order**: **Setup**, then **Foundational** (which blocks every story), then each **user-story** phase in priority order (P1 first), then **Polish**. `tasks.md` lays each phase out as ordered **waves** separated by `**⟶ Wait …**` join lines. The waves are a **dependency map**: tasks inside one wave are independent of each other, so any order is safe, and a `⟶ Wait` line marks where the next tasks depend on everything above it. **Execute wave by wave, in order, and stop at each `⟶ Wait` line until the wave above is done.** Halt on a failed task and report the cause.

3. **Dispatch one worker per user-story phase that owns five or more files**, when you have a subagent tool (Claude Code's `Agent`/`Task` tool or your host's equivalent): read `.specify/extensions/companion/commands/reference/fan-out.md` first and follow it, including the check at each join line. Count the phase's own `Files:` line, and that alone decides it. It holds in an auto run too. Every other phase, Setup, Polish, and everything without a subagent tool, you build yourself. **In Foundational, before each wave, run `python3 .specify/extensions/companion/scripts/dispatch-briefs.py --feature-dir <feature_directory> --waves` and do exactly what it prints.** Setup and Polish stay with you.

4. **What you build yourself** (Setup, Polish, small phases and waves, or everything without a subagent tool), **close each wave with one call the moment its last task is done**, listing its tasks:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --close-task <T001,T002,…> --by ai --did "<one line for the wave>" --files "<files>"
   ```
   One call folds the finishes, checks the boxes and times the wave as one unit. Never hand-edit a checkbox.


6. **Run the project's own checks before you call this done.** Validating against the spec's **Functional Requirements** and **Success Criteria** by reading is not validation. Run the suite and the type-check or build the project actually uses, read from its `package.json` scripts, `Makefile`, or the repo's own instructions, and do not invent a command: a test you wrote and never executed is a guess about your own code.

   - **A test you authored that fails is your task, not a follow-up.** Fix it now.
   - **A pre-existing test your change invalidated is also yours.** Renaming what a component shows breaks the test asserting the old text. Updating it is part of the change, not scope creep.
   - **A test file that does not compile counts as failing.** Check the suite actually ran, not merely that the command exited.
   - **If you genuinely cannot run them**, because no test script exists or the environment forbids it, say so explicitly in the summary and record it as a concern below. Do not describe a read-through as though it were a run.

   **Then read your own diff and delete what it does not need**: a helper with one caller, a branch no input reaches, a wrapper that only forwards. Then report a short summary of what was built and anything left undone.

**Output**: working changes per `tasks.md`, with completed tasks checked off.
