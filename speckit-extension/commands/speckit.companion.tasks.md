---
description: "Companion tasks — files/dependencies task axis"
---

## User Input

```text
$ARGUMENTS
```

## Outline

Produce tasks organized by **files and dependencies**, not grouped under user stories.

<!-- speckit-companion:part parallel -->
## Parallel work — default to subagents when your provider supports them

If your provider can spawn subagents (for example Claude Code's Task tool), **make concurrency your default execution strategy, not an optional optimization.** When the capability is there, using it is expected; sequential is the fallback for chat-only hosts, not the comfortable path. Do not default to one-thing-at-a-time just because it feels simpler.

- **Investigation.** Fan out independent reads across subagents (one per area) and return distilled findings, instead of reading every file serially into the main context.
- **Tasks.** Organize `tasks.md` into **waves** — each wave a set of different-file, no-shared-dependency tasks that are parallel by construction. The wave *is* the batch; you don't infer it from inline markers.
- **Implement.** Run the waves in order. For each wave, issue one subagent per task **in a single message** so the whole wave runs concurrently, then let the main agent do the bookkeeping. Do **not** grind through a wave's tasks one at a time. The next wave waits for the current one.

Only when you genuinely cannot spawn subagents, run sequentially — no error, identical artifacts.
<!-- /speckit-companion:part parallel -->

1. Read `.specify/feature.json` for the feature directory; load `plan.md` and `spec.md` (and `data-model.md` / `contracts/` if present).

2. Build the dependency graph, then **level it into waves**. A wave is a set of tasks that can all run at the same time — they touch different files and none depends on another in the same wave. Wave 1 is everything with no prerequisite; Wave 2 is everything whose prerequisites are all in Wave 1; and so on. This is how `tasks.md` is organized — by waves, not by a flat list and not by user story. Waves are parallel **by construction**, so implement can fan them out without re-deriving batches from inline markers.

3. Write `<feature_directory>/tasks.md`. Open with one line: tasks run wave by wave; every task in a wave runs concurrently, and a wave starts only after the one before it finishes. Then emit each wave as a section:
   ```text
   ## Wave 1 — <short label> (parallel)
   - [ ] T001 Description with exact file path
   - [ ] T002 Description with exact file path
   ```
   - Header is `## Wave N — <label>`; the label hints at the work (Setup, Types, Components, Integration, Polish). Add `(parallel)` when the wave has more than one task.
   - Every task line is `- [ ] T### Description with the exact file it creates or edits`. Keep the `T###` id right after the checkbox. **Do not** put `[P]` markers on tasks — the wave already means "parallel"; a single-task wave means "alone".
   - Each task touches **one** file. Two tasks in the same wave must never touch the same file. A task that depends on another's output goes in a later wave (or its own single-task wave if nothing can run beside it).
   - Prefer wide waves: when an implementation file and its test have a stable contract, put **both in the same wave** (one subagent writes `Foo.tsx`, another writes `Foo.test.tsx`). Independent components, independent helpers, and a file + its co-located test are the common same-wave pairings.
   - **When same-wave tasks share an interface, write the interface ONCE as a wave `> Contract:` line, not twice in two task descriptions.** Concurrent subagents can't see each other's files, so two descriptions that each *describe* the same shape are exactly where they drift (a default-vs-named export, a handler named two ways). Put a single `> Contract:` note right under the wave header that every task in the wave — and the implement step's subagents — follows verbatim: the **export shape** (default to a **named export** unless the codebase convention is otherwise — that alone removes the most common drift), the exact **signature** (props/params/return), and the **names** of any shared handlers or test attributes. Example: `> Contract: \`useTags()\` (named export from \`src/store/tags.tsx\`) → \`{ tags: Tag[]; addTag(name: string): void; removeTag(id: string): void }\`.`
   - **Keep a tight producer→consumer chain in one task, not a same-wave fan-out.** When several files just thread the *same new prop* through a render tree (page → list → row), one collision in the shared shape can't be self-healed by concurrent agents — write the chain as a **single coherent task** one subagent owns end to end. Reserve same-wave splitting for files that are genuinely independent.
   - No user-story labels, no per-story test sections, no MVP framing — traceability is to files and requirements (`FR-…`).

4. End with a short **Dependencies & waves** note: one line per wave saying what it needs from earlier waves, and call out any same-wave pair that shares a pinned contract.

**Output**: `<feature_directory>/tasks.md` organized into dependency-leveled parallel waves.


5. **Adversarial gap review — attack the artifacts before implementing them.** With `tasks.md` written, take one pass whose only job is to find the destructive, lifecycle, and edge-case interactions that lean specs under-specify and ship broken. This is not a rewrite and not a generator of busywork — it is a skeptic reading `spec.md`, `plan.md`, and `tasks.md` together and asking "what real failure is unspecified or untasked here?"
   - **If you can spawn subagents, run this as a small panel — distinct lenses, concurrently — not one generalist.** Issue the reviewers in a single message (the parallel investigation in plan banked the time for exactly this), each attacking a different failure family, then merge their findings on the main agent: dedup overlaps, and keep only gaps tied to a concrete failure. Diversity catches what one reader misses; the merge + the skeptic rule below keep it from flooding false positives. A good split of lenses:
     - **Destructive cascades** — when an entity is deleted/removed, what dangling references, orphaned data, or stale UI is left behind, in *every* direction (not just the obvious one)?
     - **Active-state vs. mutation** — if the user is filtering/selecting/viewing something and the thing it depends on is removed or changes, what happens?
     - **Persistence & boundary** — what survives a reload that shouldn't (or doesn't that should), and the empty / zero / duplicate / whitespace / max cases.
   - On a host without subagents, do the same sweep inline as one careful pass over the same lenses.
   - For each candidate, decide honestly whether it is already covered by a specific `FR-…` **and** a task. A behavior asserted in prose (an Overview or Assumptions sentence) but with no requirement and no task is still a gap. **Only surface a gap you can tie to a concrete failure; if the spec already covers it, say nothing.** A thorough spec produces zero findings — that is a valid, expected result, not a reason to invent issues.
   - For every genuinely-uncovered gap that would ship a user-visible bug, **close it in `tasks.md`**: add the missing task(s) — to the right wave, or a final remediation wave — in the same wave format, each naming the exact file and the requirement it satisfies. Different-file remediation tasks may share a wave; keep the same-file/dependency rules.
   - Report a one-line verdict: implementation-ready, or how many high-severity gaps you closed.

**Output**: `tasks.md`, with any high-severity coverage gaps the review found added as tasks.


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
