---
description: "Companion lean tasks — files/dependencies task axis (per-spec opt-in)"
---

## User Input

```text
$ARGUMENTS
```

## Outline

Produce tasks organized by **files and dependencies**, not grouped under user stories.

1. Read `.specify/feature.json` for the feature directory; load `plan.md` and `spec.md` (and `data-model.md` / `contracts/` if present).

2. Create `<feature_directory>/tasks.md` as a dependency-ordered checklist. Group by execution layer, not by story:
   - **Setup** — project/structure/config prerequisites.
   - **Foundational** — shared pieces every later task depends on (blocking).
   - **Core work** — one task per file/module/unit, ordered so dependencies come first.
   - **Integration** — wiring the units together.
   - **Polish** — docs, cleanup, validation against the spec's Success Criteria.

3. Every task uses the strict format:
   ```text
   - [ ] [TaskID] [P?] Description with exact file path
   ```
   - `[P]` marks tasks touching different files with no incomplete dependency (parallelizable).
   - Each task names the concrete file it creates or edits.
   - No user-story labels, no per-story test sections, no MVP framing — traceability is to files and requirements (`FR-…`).

4. Add a short **Dependencies** note (what blocks what) and a **Parallel** note (which `[P]` tasks can run together).

**Output**: `<feature_directory>/tasks.md` organized by files/dependencies.


<!-- speckit-companion:timing -->
## Timing — keep `.spec-context.json` honest

These rules apply to every Companion profile command. The extension records lifecycle timing with its own scripts wherever it can; these rules keep anything you append consistent with that and accurate for any dispatcher (terminal, IDE chat, or the GUI).

- **Live timestamps.** When you append a history entry yourself, stamp it by running `date -u +"%Y-%m-%dT%H:%M:%SZ"` at that moment. Never hand-type a timestamp, never reuse an earlier value, never stamp several entries with one shared value.
- **Self-close — but not specify or implement.** When your own work for **plan, tasks, clarify, or analyze** ends, append `{ "step": "<this step>", "substep": null, "kind": "complete", "by": "ai", "at": "<date -u output>" }`. Do NOT self-close **specify** or **implement**: the extension closes those itself (specify from its own command, implement from the end-of-step hook), so an `ai` complete there would duplicate it.
- **Substeps live.** For each substep boundary, append its own entry with that substep name and its own fresh `date -u` the moment it finishes — not batched at the end.
- **Implement: do not journal timing.** Just mark each task `- [x] **<TaskID>**` in `tasks.md` as you finish it and append `task_summaries.<TaskID>`. The end-of-step hook records every task's start + complete and the implement step's end — leave all implement timing to it.
- **Never write the next step's start.** Only the next command appends the next step's start entry; writing it here makes the viewer render a phantom "Generating <next>…".
<!-- /speckit-companion:timing -->
