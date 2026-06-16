---
id: implement-exec
kind: author
command: implement
writes: tasks.md
reads: []
---
1. Read `.specify/feature.json` for the feature directory; load `<feature_directory>/tasks.md`, `plan.md`, and `spec.md`. Then record the **implement START** so the step's duration begins now (the script stamps the real clock; the end-of-step hook records each task and closes the step — do not hand-write implement timing):
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step implement --status implementing --kind start --by extension
   ```

2. Execute `tasks.md` **wave by wave, in order**. A wave is a barrier: every task in it runs at once, and you do not begin the next wave until the current one is fully done. For each `## Wave N` section, top to bottom:
   - **Fan out — this is the mechanical default on Claude Code, not an optional optimization.** Issue one subagent (Task tool) call per task in the wave, **all in a single message**, so the whole wave runs concurrently. A wave of N tasks is N Task calls in one batch. Each subagent makes **only** its task's code edits, touches no file outside its task, returns a one-line summary, and does **not** edit `tasks.md` or `.spec-context.json`. Do not collapse a multi-task wave into one sequential pass because it feels simpler — the wave was built to run in parallel.
   - **Hand every subagent in the wave its `> Contract:` line verbatim.** If the wave declares a shared contract (a pinned export shape + signature + handler/attribute names), paste it into each subagent's brief unchanged, so files written side by side code to the *same* shape instead of each guessing. This is the cheapest way to stop seam drift before it starts.
   - **Wait for the whole wave, then reconcile it.** Concurrent subagents can't see each other's choices, so the **seams between same-wave files** are where drift lands — a test that imported a default export the implementation made named, two files that named a shared prop differently, a contract one side pinned and the other guessed. On the **main agent**, type-check/build the touched files and fix any such seam drift before moving on. This reconciliation pass is expected, not a failure of fan-out.
   - **Then do the bookkeeping** — on the **main agent only**, never a subagent — one finished task at a time: mark `- [x]` in `tasks.md` and run `write-context.py` for it. Keeping all writes to the shared `tasks.md` / `.spec-context.json` on the foreground main agent is what stops them racing (timing rules unchanged).
   - If a task in the wave fails, journal the others, report the cause, and **stop before the next wave** — a later wave may depend on it. A single-task wave is just one subagent (or done inline). Only a host that genuinely cannot spawn subagents runs a wave's tasks sequentially — identical artifacts. A project may route task types to specialist subagents via a hook (the agent-routing seam).

3. Bookkeeping stays on the main agent (per step 2): after each task finishes, mark it `- [x]` in `tasks.md` — never from a subagent.

4. On completion, validate the result against the spec's **Functional Requirements** and **Success Criteria**, and report a short summary of what was built and anything left undone.

**Output**: working changes per `tasks.md`, with completed tasks checked off.


