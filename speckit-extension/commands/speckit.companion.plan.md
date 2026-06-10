---
description: "Companion turbo plan — turbo plan.md (per-spec opt-in)"
---

## User Input

```text
$ARGUMENTS
```

## Outline

Produce a **turbo** plan — just enough to drive tasks. No multi-phase research scaffolding, no dual-option structure trees.

1. Read `.specify/feature.json` for the feature directory; load `<feature_directory>/spec.md` and `.specify/memory/constitution.md` if present.

2. Create `<feature_directory>/plan.md` with these sections, in order:
   - **Summary** — the primary requirement plus the technical approach in 2–4 sentences.
   - **Technical Context** — language/version, primary dependencies, storage, testing, target platform, hard constraints. Mark unknowns `NEEDS CLARIFICATION`.
   - **Approach & Structure** — the concrete files/modules this touches (real paths) and the order of attack. Organize by file/dependency, not by user story. (This replaces the stock Project Structure trees.)
   - **Out of Scope** — what this explicitly does not do.

3. If the constitution defines gates, add a short **Constitution Check** (pass / justified violations). Omit the Complexity-Tracking table unless there is a real violation to justify.

4. **Side files — assess on demand.** Create each only when it genuinely helps a developer understand or build *this* change; when the information fits naturally in `plan.md`, keep it there instead of spawning a file. Judge per feature:
   - `research.md` — only for real unknowns or trade-offs worth recording on their own; otherwise fold a short "Decisions" note into `plan.md`.
   - `data-model.md` — only when the change introduces or reshapes entities a dev needs spelled out to implement it.
   - `contracts/` — only when it exposes an interface (API / CLI / schema / UI) a consumer codes against.
   - `quickstart.md` — only when there is a non-obvious setup or verification path a dev would otherwise miss.
   Default to folding into `plan.md`; create a side file only when its absence would slow understanding or implementation.

**Output**: `<feature_directory>/plan.md` (+ any side files that genuinely help: `research.md` / `data-model.md` / `contracts/` / `quickstart.md`).


<!-- speckit-companion:timing -->
## Timing — keep `.spec-context.json` honest

These rules apply to every Companion profile command. The extension records lifecycle timing with its own scripts wherever it can; these rules keep anything you append consistent with that and accurate for any dispatcher (terminal, IDE chat, or the GUI). The model is **finish-only**: each task and each substep records a *single* finish event, and its duration is the gap to the previous finish (or the step's start). Never a `start`+`complete` pair for a task or substep — a pair stamped at one instant is what produces `0s` ticks and bursts.

- **Live timestamps.** When you append a history entry yourself, stamp it by running `date -u +"%Y-%m-%dT%H:%M:%SZ"` at that moment. Never hand-type a timestamp, never reuse an earlier value, never stamp several entries with one shared value.
- **Self-close — but not specify or implement.** When your own work for **plan, tasks, clarify, or analyze** ends, append `{ "step": "<this step>", "substep": null, "kind": "complete", "by": "ai", "at": "<date -u output>" }`. Do NOT self-close **specify** or **implement**: the extension closes those itself (specify from its own command, implement from the end-of-step hook), so an `ai` complete there would duplicate it.
- **Substeps — one finish each.** For each substep boundary (plan: `research`, `design`; tasks: `generate`) append a single finish `{ "step": "<step>", "substep": "<name>", "kind": "complete", "by": "ai", "at": "<fresh date -u>" }` the moment that substep ends. One entry per substep, each with its own real timestamp — never two substeps sharing a value, never a separate `start`. The delta between consecutive finishes is each substep's duration.
- **Implement — journal each task with a script (finish-only).** As you finish each task: mark it `- [x] **<TaskID>**` in `tasks.md`, append `task_summaries.<TaskID>`, then run (feature dir from `.specify/feature.json`):

  ```bash
  python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --task <TaskID> --kind complete --by ai
  ```

  Run this **the moment that task completes** — one finish per task, as you go. Do NOT defer journaling to the end of the step and do NOT dump every task's finish in one end-of-step batch: that collapses their real durations into a single instant, and the cadence check now FAILS a run whose task finishes are clustered into a tiny fraction of the step's real duration. This stamps **one** finish event from the real clock — its delta to the previous task's finish is that task's duration. Do NOT hand-author per-task JSON and do NOT write a per-task `start`. The end-of-step hook is a backstop that fills any task you didn't journal (it won't duplicate one you did). Parallel `[P]` tasks: journal each as it finishes; the batch's time is attributed to whichever finishes last (accepted limitation).
- **Never write the next step's start.** Only the next command appends the next step's start entry; writing it here makes the viewer render a phantom "Generating <next>…".
<!-- /speckit-companion:timing -->
