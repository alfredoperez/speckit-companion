---
description: Create a lean implementation plan and store it in plan.md.
---

## User Input

```text
$ARGUMENTS
```

## Outline

Produce a **lean** plan — just enough to drive tasks. No multi-phase research scaffolding, no dual-option structure trees.

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

These rules apply to every Companion profile command. The extension records lifecycle timing with its own scripts wherever it can; these rules keep anything you append consistent with that and accurate for any dispatcher (terminal, IDE chat, or the GUI).

- **Live timestamps.** When you append a history entry yourself, stamp it by running `date -u +"%Y-%m-%dT%H:%M:%SZ"` at that moment. Never hand-type a timestamp, never reuse an earlier value, never stamp several entries with one shared value.
- **Self-close — but not specify or implement.** When your own work for **plan, tasks, clarify, or analyze** ends, append `{ "step": "<this step>", "substep": null, "kind": "complete", "by": "ai", "at": "<date -u output>" }`. Do NOT self-close **specify** or **implement**: the extension closes those itself (specify from its own command, implement from the end-of-step hook), so an `ai` complete there would duplicate it.
- **Substeps live.** For each substep boundary, append its own entry with that substep name and its own fresh `date -u` the moment it finishes — not batched at the end.
- **Implement: do not journal timing.** Just mark each task `- [x] **<TaskID>**` in `tasks.md` as you finish it and append `task_summaries.<TaskID>`. The end-of-step hook records every task's start + complete and the implement step's end — leave all implement timing to it.
- **Never write the next step's start.** Only the next command appends the next step's start entry; writing it here makes the viewer render a phantom "Generating <next>…".
<!-- /speckit-companion:timing -->
