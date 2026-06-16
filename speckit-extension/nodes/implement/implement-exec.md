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

2. Execute `tasks.md` **phase by phase, in dependency order**: complete **Setup**, then **Foundational** (which blocks every story), then each **user-story** phase in priority order (P1 first), then **Polish**. Within a story, write any tests first and confirm they fail before implementing; then go models → services → UI → integration. Halt on a failed task and report the cause.
   - **Run the independent (`[P]`) tasks in a phase concurrently — the default on Claude Code, not an optional optimization.** Within the current phase, the `[P]` tasks (different files, no incomplete dependency) form a batch: **issue one subagent (Task tool) per task in the batch, all in a single message,** so they run at once. Each subagent makes only its task's edits, touches no file outside it, returns a one-line summary, and does **not** edit `tasks.md` or `.spec-context.json`. If the tasks share an interface (a contract pinned in `tasks.md`/`contracts/`), paste that contract into each subagent's brief verbatim so they don't drift. Same-file or dependent tasks stay ordered (never in one batch). A host without subagents runs the batch sequentially — identical result.
   - **After a batch returns, reconcile it** (main agent): type-check/build the touched files and fix any seam drift between the files written side by side, before moving on. Then do the bookkeeping below.

3. **Append each task's finish, then materialize per batch (main agent owns `tasks.md`).** As the batch reconciles, mark each finished task `- [x]` in `tasks.md` and **append** its finish with `--append` (the parallel-safe, no-read path — see the Timing rules below), one per task. Then run a single `--materialize` to fold the batch's lines into `.spec-context.json` so the panel updates. The append is cheap and never re-serializes the parallel work; only `tasks.md` stays single-writer (the main agent), never a subagent.

4. On completion, validate the result against the spec's **Functional Requirements** and **Success Criteria**, and report a short summary of what was built and anything left undone.

**Output**: working changes per `tasks.md`, with completed tasks checked off.
