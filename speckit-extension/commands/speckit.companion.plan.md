---
description: "Companion lean plan — lean plan.md (per-spec opt-in)"
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

4. **Side files, on demand only:** fold key decisions into a short "Decisions" note inside `plan.md` instead of a separate `research.md`. Write `data-model.md` only if the feature has entities, and `contracts/` only if it exposes an interface (API / CLI / schema / UI). Do not write `quickstart.md` — verification lives in `tasks.md` + Success Criteria.

**Output**: `<feature_directory>/plan.md` (+ conditional `data-model.md` / `contracts/`).


<!-- speckit-companion:timing -->
## Timing — keep `.spec-context.json` honest

These rules apply to every Companion profile command. They make per-step durations and per-task cadence accurate for any dispatcher (terminal, IDE chat, or the GUI), not just when the GUI prepends its preamble.

- **Live timestamps.** Obtain every timestamp by running `date -u +"%Y-%m-%dT%H:%M:%SZ"` at the moment the entry happens. Never hand-type a timestamp, never reuse an earlier value, and never stamp several entries with one shared value.
- **Self-close this step.** When *your own work for this step* ends, append a history entry `{ "step": "<this step>", "substep": null, "kind": "complete", "by": "ai", "at": "<date -u output>" }`. Do not rely on the next step to close this one — that is what corrupts specify's duration.
- **Substeps live.** For each substep boundary, append its own entry with that substep name and its own fresh `date -u` timestamp the moment it finishes — not batched at the end.
- **Implement: per task.** As you finish each task in `tasks.md` (the moment you mark its `- [x] **<TaskID>**`), append BOTH a start and a complete for it, each with its own `date -u`: `{ "step": "implement", "substep": "<TaskID>", "task": "<TaskID>", "kind": "start", "by": "ai", "at": "<date -u>" }` then the matching `"kind": "complete"`. One fresh `date -u` per task — do not batch; the per-task cadence is the point. The `task` field lets the end-of-step hook treat already-journaled tasks as a no-op.
- **Never write the next step's start.** Only the next command appends the next step's start entry; writing it here makes the viewer render a phantom "Generating <next>…".
<!-- /speckit-companion:timing -->
