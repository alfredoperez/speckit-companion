---
description: "Companion implement — execute tasks.md in dependency order"
---

## User Input

```text
$ARGUMENTS
```

## Outline

<!-- speckit-companion:part parallel -->
## Parallel work — default to subagents when your provider supports them

If your provider can spawn subagents (for example Claude Code's Task tool), **make concurrency your default execution strategy, not an optional optimization.** When the capability is there, using it is expected; sequential is the fallback for chat-only hosts, not the comfortable path. Do not default to one-thing-at-a-time just because it feels simpler.

- **Investigation.** Fan out independent reads across subagents (one per area) and return distilled findings, instead of reading every file serially into the main context.
- **Tasks.** Organize `tasks.md` into **waves** — each wave a set of different-file, no-shared-dependency tasks that are parallel by construction. The wave *is* the batch; you don't infer it from inline markers.
- **Implement.** Run the waves in order. For each wave, issue one subagent per task **in a single message** so the whole wave runs concurrently, then let the main agent do the bookkeeping. Do **not** grind through a wave's tasks one at a time. The next wave waits for the current one.

Only when you genuinely cannot spawn subagents, run sequentially — no error, identical artifacts.
<!-- /speckit-companion:part parallel -->

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


<!-- speckit-companion:part timing -->
## Timing — keep `.spec-context.json` honest

These rules apply to every Companion profile command. The extension records lifecycle timing with its own scripts wherever it can; these rules keep anything you append consistent with that and accurate for any dispatcher (terminal, IDE chat, or the GUI). The model is **finish-only**: each task and each substep records a *single* finish event, and its duration is the gap to the previous finish (or the step's start). Never a `start`+`complete` pair for a task or substep — a pair stamped at one instant is what produces `0s` ticks and bursts.

- **Live timestamps.** When you append a history entry yourself, stamp it by running `date -u +"%Y-%m-%dT%H:%M:%SZ"` at that moment. Never hand-type a timestamp, never reuse an earlier value, never stamp several entries with one shared value.
- **Self-close — but not specify or implement.** When your own work for **plan, tasks, clarify, or analyze** ends, append `{ "step": "<this step>", "substep": null, "kind": "complete", "by": "ai", "at": "<date -u output>" }`. Do NOT self-close **specify** or **implement**: the extension closes those itself (specify from its own command, implement from the end-of-step hook), so an `ai` complete there would duplicate it.
- **Substeps — one finish each.** For each substep boundary (plan: `research`, `design`; tasks: `generate`) append a single finish `{ "step": "<step>", "substep": "<name>", "kind": "complete", "by": "ai", "at": "<fresh date -u>" }` the moment that substep ends. One entry per substep, each with its own real timestamp — never two substeps sharing a value, never a separate `start`. The delta between consecutive finishes is each substep's duration.
- **Implement — journal each task with a script (finish-only).** As you finish each task: mark it `- [x] **<TaskID>**` in `tasks.md`, then run (feature dir from `.specify/feature.json`):

  ```bash
  python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --task <TaskID> --kind complete --by ai --did "<one-line summary of what this task did>" --files "<comma,separated,files,touched>"
  ```

  The `--did`/`--files` flags make the script write `task_summaries.<TaskID>` (the field the Activity panel's Tasks card reads) in the same call that records the finish — so the panel is populated by the script, NOT by a hand-authored `.spec-context.json` edit. Do NOT also hand-edit `task_summaries` yourself; the script owns it. Run this **the moment that task completes** — one finish per task, as you go. Do NOT defer journaling to the end of the step and do NOT dump every task's finish in one end-of-step batch: that collapses their real durations into a single instant, and the cadence check now FAILS a run whose task finishes are clustered into a tiny fraction of the step's real duration. This stamps **one** finish event from the real clock — its delta to the previous task's finish is that task's duration. Do NOT hand-author per-task JSON and do NOT write a per-task `start`. The end-of-step hook is a backstop that fills any task you didn't journal (it won't duplicate one you did). Tasks in the same parallel wave: the main agent journals each as its subagent returns; the wave's time is attributed to whichever finishes last (accepted limitation).
- **Never write the next step's start.** Only the next command appends the next step's start entry; writing it here makes the viewer render a phantom "Generating <next>…".
<!-- /speckit-companion:part timing -->

<!-- speckit-companion:part self-advance -->
## Self-advance — hand off to the next step

This is one step in the Companion pipeline. How the run continues depends on the environment you are running in; do not invoke a separate headless/deterministic run command for the everyday flow.

- **On an agentic CLI that keeps acting after a step finishes:** once this step's work is complete, read the Companion workflow definition (`speckit-extension/workflows/speckit-companion.workflow.yml`) to learn which step comes next, then continue into it on your own — dispatch the next step's `/speckit.companion.*` command and keep going through the pipeline.
- **Pause at every review gate.** Where the workflow marks a `gate` (e.g. review-spec, review-plan), stop and wait for approval rather than running past it. Only continue once the gate is approved.
- **Terminal step after implement.** After the implementation step finishes (and any commit step), the workflow's final step is `mark-complete`. Run it so the spec lands at `status: completed`. That step writes `completed` only through `write-context.py --mark-complete`, which refuses unless the spec is already `implemented` — never introduce a second completed-writer.
- **Degrade gracefully on a one-shot environment.** If your environment runs one step and then stops, the handoff simply does not fire: finish this step, record its progress, and stop. The run stays valid and resumable, and the next step is triggered manually (by the developer or the companion panel). Completion likewise stays a manual action there.
<!-- /speckit-companion:part self-advance -->

<!-- speckit-companion:part orchestrator -->
## Node hooks — run the project's `before`/`after` inserts

This command is assembled from ordered **nodes**. A project can attach its own work at the boundary *before* or *after* any node by declaring it in `.specify/companion.yml`. You are the runtime: read that file (if present) and run those hooks at the right moments. Like the rest of the pipeline, this must **never fail the host command** — degrade and continue.

**Find the hooks for this command.** Look up `commands.<this-command>.hooks` in `.specify/companion.yml`. It has two anchors, `before` and `after`, each keyed by a node id from this command's order. Run a node's `before` hooks immediately before that node's work, and its `after` hooks immediately after. When several hooks sit at one anchor, run them **top to bottom, in declared order**.

**Hook types:**

- `{ type: command, run: "<shell>" }` — run the shell command with your terminal/Bash tool, then continue. *If you have no terminal tool* (some chat-only providers), do not pretend to: report the command you would have run and continue.
- `{ type: prompt, text: "<instruction>" }` — treat the text as an inline instruction and act on it before moving on.
- `{ type: node, ref: <id> }` — read `.specify/companion/nodes/<id>.md` and carry out its body as if it were part of this command.

**Background hooks.** Any hook may add `background: true`. Kick it off and continue the pipeline immediately without waiting for it to finish — it must not hold the spec prisoner. Use it for slow, independent side-effects (a test run, a build, a notification): for a `command`, launch it detached (e.g. append `&` or use `nohup … &`); for a `node`/`prompt`, do its work without blocking the next step. Report its result whenever it lands, but never block on it. **Do not** mark a `background` hook on anything that writes `.spec-context.json` (the timing/capture calls): those are fast already and run a read-modify-write on the shared file, so two of them racing in the background can lose an update. Background is for side-effects, not bookkeeping.

**Failure handling (never abort the host command):**

- **No `.specify/companion.yml`** → there are no hooks; run the command exactly as written. Do not warn.
- **The file is malformed / unparseable** → ignore it, note one short warning, and run the shipped command unchanged.
- **A hook is anchored to a node that isn't in this run's order** (e.g. a recipe dropped it) → warn once and skip that anchor's hooks.
- **A `type: node` hook's `ref` file is missing** → this is a real misconfiguration: report it clearly and stop before doing damage, rather than silently skipping.

If a hook's own work fails (a `command` exits non-zero, a `node` can't complete), report it and — unless the failure clearly makes the rest unsafe — continue the pipeline. The host command's own output is never blocked by a hook.
<!-- /speckit-companion:part orchestrator -->
