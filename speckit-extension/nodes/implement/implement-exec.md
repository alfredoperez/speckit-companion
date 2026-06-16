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

2. Execute `tasks.md` **phase by phase, in dependency order**: complete **Setup**, then **Foundational** (which blocks every story), then each **user-story** phase in priority order (P1 first), then **Polish**. Within a story, write any tests first and confirm they fail before implementing; then go models → services → UI → integration. A `[P]` marker is advisory — when subagents are available you may run a `[P]` group concurrently, but the faithful default is straightforward in-order execution; a host without subagents runs everything in sequence with an identical result. Halt on a failed task and report the cause.

3. **Journal each task as it finishes (main agent only).** The moment a task completes, mark it `- [x]` in `tasks.md` and record it with the script so timing stays honest (see the Timing rules below) — one finish per task, as you go, never batched at the end.

4. On completion, validate the result against the spec's **Functional Requirements** and **Success Criteria**, and report a short summary of what was built and anything left undone.

**Output**: working changes per `tasks.md`, with completed tasks checked off.
