---
description: A lightweight, non-destructive consistency pass over the lean spec/plan/tasks.
---

## User Input

```text
$ARGUMENTS
```

## Outline

A lean analyze — a quick consistency check, not a full cross-artifact matrix. Read-only: report findings, change nothing.

1. Read `.specify/feature.json` for the feature directory; load `spec.md`, `plan.md`, and `tasks.md` (and `data-model.md` / `contracts/` if present).

2. Check the few things that actually break a build:
   - Every `tasks.md` item traces to a requirement (`FR-…`) or a concrete file in the plan; no orphan tasks.
   - Every Functional Requirement is covered by at least one task.
   - Plan's Approach & Structure paths match the files the tasks touch.
   - No contradictions between spec, plan, and tasks.

3. Report findings as a short list (issue · where · suggested fix). Do **not** edit any artifact — the user decides what to act on.

**Output**: a concise consistency report in the chat; no file written.


<!-- speckit-companion:timing -->
## Timing — keep `.spec-context.json` honest

These rules apply to every Companion profile command. They make per-step durations and per-task cadence accurate for any dispatcher (terminal, IDE chat, or the GUI), not just when the GUI prepends its preamble.

- **Live timestamps.** Obtain every timestamp by running `date -u +"%Y-%m-%dT%H:%M:%SZ"` at the moment the entry happens. Never hand-type a timestamp, never reuse an earlier value, and never stamp several entries with one shared value.
- **Self-close this step.** When *your own work for this step* ends, append a history entry `{ "step": "<this step>", "substep": null, "kind": "complete", "by": "ai", "at": "<date -u output>" }`. Do not rely on the next step to close this one — that is what corrupts specify's duration.
- **Substeps live.** For each substep boundary, append its own entry with that substep name and its own fresh `date -u` timestamp the moment it finishes — not batched at the end.
- **Implement: per task.** As you finish each task in `tasks.md` (the moment you mark its `- [x] **<TaskID>**`), append BOTH a start and a complete for it, each with its own `date -u`: `{ "step": "implement", "substep": "<TaskID>", "task": "<TaskID>", "kind": "start", "by": "ai", "at": "<date -u>" }` then the matching `"kind": "complete"`. One fresh `date -u` per task — do not batch; the per-task cadence is the point. The `task` field lets the end-of-step hook treat already-journaled tasks as a no-op.
- **Never write the next step's start.** Only the next command appends the next step's start entry; writing it here makes the viewer render a phantom "Generating <next>…".
<!-- /speckit-companion:timing -->
