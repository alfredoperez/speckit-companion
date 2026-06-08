---
description: Create a dependency-ordered task list (files/dependencies axis) and store it in tasks.md.
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

These rules apply to every Companion profile command. They make per-step durations and per-task cadence accurate for any dispatcher (terminal, IDE chat, or the GUI), not just when the GUI prepends its preamble.

- **Live timestamps.** Obtain every timestamp by running `date -u +"%Y-%m-%dT%H:%M:%SZ"` at the moment the entry happens. Never hand-type a timestamp, never reuse an earlier value, and never stamp several entries with one shared value.
- **Self-close this step.** When *your own work for this step* ends, append a history entry `{ "step": "<this step>", "substep": null, "kind": "complete", "by": "ai", "at": "<date -u output>" }`. Do not rely on the next step to close this one — that is what corrupts specify's duration.
- **Substeps live.** For each substep boundary, append its own entry with that substep name and its own fresh `date -u` timestamp the moment it finishes — not batched at the end.
- **Implement: per task.** As you finish each task in `tasks.md` (the moment you mark its `- [x] **<TaskID>**`), append BOTH a start and a complete for it, each with its own `date -u`: `{ "step": "implement", "substep": "<TaskID>", "task": "<TaskID>", "kind": "start", "by": "ai", "at": "<date -u>" }` then the matching `"kind": "complete"`. One fresh `date -u` per task — do not batch; the per-task cadence is the point. The `task` field lets the end-of-step hook treat already-journaled tasks as a no-op.
- **Never write the next step's start.** Only the next command appends the next step's start entry; writing it here makes the viewer render a phantom "Generating <next>…".
<!-- /speckit-companion:timing -->
