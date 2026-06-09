---
description: Create a lean specification and store it in spec.md.
---

## User Input

```text
$ARGUMENTS
```

## Outline

Produce a lean specification — **no user-story / user-scenario section**. Capture intent as testable requirements, not narrative journeys.

1. **Resolve the feature directory.** Use `.specify/feature.json` if present; otherwise ask the user for the path (e.g. `specs/my-feature`) and write it:
   ```json
   { "feature_directory": "<feature_directory>" }
   ```
   Ensure `<feature_directory>/` exists, then record the **specify START** so the step's duration begins now (the script stamps the real clock — do not hand-write this):
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step specify --status specifying --kind start --by extension
   ```

2. Create `<feature_directory>/spec.md` with exactly these sections, in order:
   - **Overview** — 1–3 sentences: what this delivers and why. No implementation detail. (This replaces the stock user-scenarios narrative.)
   - **Functional Requirements** — a numbered `FR-001…` list. Each requirement is a single, testable MUST/SHOULD statement. Mark a genuinely unresolvable choice with `[NEEDS CLARIFICATION: …]` (max 3; prefer informed defaults).
   - **Success Criteria** — measurable, technology-agnostic `SC-001…` outcomes (time, count, percentage, pass/fail). No framework or API names.
   - **Assumptions** — the informed defaults you chose for anything unspecified.

3. Keep it business-readable. Do **not** add user stories, acceptance-scenario tables, priority labels, or a separate quality checklist — lean tracks requirements and outcomes directly. Fold edge cases into Functional Requirements or Assumptions.

**Output**: `<feature_directory>/spec.md` (Overview / Functional Requirements / Success Criteria / Assumptions).

**Record completion.** After `spec.md` is written, close the specify step — the extension stamps the real end (do **not** hand-write an `ai` complete for specify):
```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step specify --status specified --kind complete --by extension
```


<!-- speckit-companion:timing -->
## Timing — keep `.spec-context.json` honest

These rules apply to every Companion profile command. The extension records lifecycle timing with its own scripts wherever it can; these rules keep anything you append consistent with that and accurate for any dispatcher (terminal, IDE chat, or the GUI).

- **Live timestamps.** When you append a history entry yourself, stamp it by running `date -u +"%Y-%m-%dT%H:%M:%SZ"` at that moment. Never hand-type a timestamp, never reuse an earlier value, never stamp several entries with one shared value.
- **Self-close — but not specify or implement.** When your own work for **plan, tasks, clarify, or analyze** ends, append `{ "step": "<this step>", "substep": null, "kind": "complete", "by": "ai", "at": "<date -u output>" }`. Do NOT self-close **specify** or **implement**: the extension closes those itself (specify from its own command, implement from the end-of-step hook), so an `ai` complete there would duplicate it.
- **Substeps live.** For each substep boundary, append its own entry with that substep name and its own fresh `date -u` the moment it finishes — not batched at the end.
- **Implement: do not journal timing.** Just mark each task `- [x] **<TaskID>**` in `tasks.md` as you finish it and append `task_summaries.<TaskID>`. The end-of-step hook records every task's start + complete and the implement step's end — leave all implement timing to it.
- **Never write the next step's start.** Only the next command appends the next step's start entry; writing it here makes the viewer render a phantom "Generating <next>…".
<!-- /speckit-companion:timing -->
