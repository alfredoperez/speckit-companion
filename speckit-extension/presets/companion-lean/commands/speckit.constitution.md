---
description: Create or update the project constitution, leanly.
---

## User Input

```text
$ARGUMENTS
```

## Outline

A lean constitution — set the principles and write the file. No exhaustive template-propagation checklist, no Sync-Impact-Report ceremony.

1. Read the existing `.specify/memory/constitution.md` if present.

2. From the user input (and repo context), fill or update the constitution:
   - **Principles** — the non-negotiable rules the project commits to, each a short titled statement with a one-line rationale.
   - **Governance** — how principles are amended and what overrides what.

3. **Version** — bump the constitution version with semantic versioning (MAJOR for a removed/redefined principle, MINOR for a new principle or section, PATCH for wording). State the new version and the date.

4. Write the result to `.specify/memory/constitution.md`. Print a 2–3 line summary of what changed. Do not crawl every template to propagate edits — note any template that clearly conflicts, but leave propagation to the user.

**Output**: an updated `.specify/memory/constitution.md` + a short change summary.


<!-- speckit-companion:timing -->
## Timing — keep `.spec-context.json` honest

These rules apply to every Companion profile command. They make per-step durations and per-task cadence accurate for any dispatcher (terminal, IDE chat, or the GUI), not just when the GUI prepends its preamble.

- **Live timestamps.** Obtain every timestamp by running `date -u +"%Y-%m-%dT%H:%M:%SZ"` at the moment the entry happens. Never hand-type a timestamp, never reuse an earlier value, and never stamp several entries with one shared value.
- **Self-close this step.** When *your own work for this step* ends, append a history entry `{ "step": "<this step>", "substep": null, "kind": "complete", "by": "ai", "at": "<date -u output>" }`. Do not rely on the next step to close this one — that is what corrupts specify's duration.
- **Substeps live.** For each substep boundary, append its own entry with that substep name and its own fresh `date -u` timestamp the moment it finishes — not batched at the end.
- **Implement: per task.** As you finish each task in `tasks.md` (the moment you mark its `- [x] **<TaskID>**`), append BOTH a start and a complete for it, each with its own `date -u`: `{ "step": "implement", "substep": "<TaskID>", "task": "<TaskID>", "kind": "start", "by": "ai", "at": "<date -u>" }` then the matching `"kind": "complete"`. One fresh `date -u` per task — do not batch; the per-task cadence is the point. The `task` field lets the end-of-step hook treat already-journaled tasks as a no-op.
- **Never write the next step's start.** Only the next command appends the next step's start entry; writing it here makes the viewer render a phantom "Generating <next>…".
<!-- /speckit-companion:timing -->
