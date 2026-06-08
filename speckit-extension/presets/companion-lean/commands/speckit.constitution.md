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

These rules apply to every Companion profile command. The extension records lifecycle timing with its own scripts wherever it can; these rules keep anything you append consistent with that and accurate for any dispatcher (terminal, IDE chat, or the GUI).

- **Live timestamps.** When you append a history entry yourself, stamp it by running `date -u +"%Y-%m-%dT%H:%M:%SZ"` at that moment. Never hand-type a timestamp, never reuse an earlier value, never stamp several entries with one shared value.
- **Self-close — but not specify or implement.** When your own work for **plan, tasks, clarify, or analyze** ends, append `{ "step": "<this step>", "substep": null, "kind": "complete", "by": "ai", "at": "<date -u output>" }`. Do NOT self-close **specify** or **implement**: the extension closes those itself (specify from its own command, implement from the end-of-step hook), so an `ai` complete there would duplicate it.
- **Substeps live.** For each substep boundary, append its own entry with that substep name and its own fresh `date -u` the moment it finishes — not batched at the end.
- **Implement: do not journal timing.** Just mark each task `- [x] **<TaskID>**` in `tasks.md` as you finish it and append `task_summaries.<TaskID>`. The end-of-step hook records every task's start + complete and the implement step's end — leave all implement timing to it.
- **Never write the next step's start.** Only the next command appends the next step's start entry; writing it here makes the viewer render a phantom "Generating <next>…".
<!-- /speckit-companion:timing -->
