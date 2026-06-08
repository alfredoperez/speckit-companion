---
description: Resolve genuine ambiguities in the lean spec with a few targeted questions.
---

## User Input

```text
$ARGUMENTS
```

## Outline

A lean clarify — no fixed five-question ceremony, no full coverage-taxonomy scan. Ask only what a reasonable default cannot resolve.

1. Read `.specify/feature.json` for the feature directory; load `<feature_directory>/spec.md`.

2. Scan the spec for genuine ambiguities — choices that materially change scope, behavior, or success criteria and where no reasonable default exists. Ignore anything an informed default already covers.

3. Ask **at most 3** targeted questions, the highest-impact first. If nothing genuinely needs clarifying, say so and stop — do not invent questions to fill a quota.

4. Write each answer back into `spec.md` **inline** (update the relevant requirement/assumption); do not create a separate artifact. Replace any `[NEEDS CLARIFICATION]` you resolve.

**Output**: an updated `<feature_directory>/spec.md` with resolved ambiguities; no new file.


<!-- speckit-companion:timing -->
## Timing — keep `.spec-context.json` honest

These rules apply to every Companion profile command. They make per-step durations and per-task cadence accurate for any dispatcher (terminal, IDE chat, or the GUI), not just when the GUI prepends its preamble.

- **Live timestamps.** Obtain every timestamp by running `date -u +"%Y-%m-%dT%H:%M:%SZ"` at the moment the entry happens. Never hand-type a timestamp, never reuse an earlier value, and never stamp several entries with one shared value.
- **Self-close this step.** When *your own work for this step* ends, append a history entry `{ "step": "<this step>", "substep": null, "kind": "complete", "by": "ai", "at": "<date -u output>" }`. Do not rely on the next step to close this one — that is what corrupts specify's duration.
- **Substeps live.** For each substep boundary, append its own entry with that substep name and its own fresh `date -u` timestamp the moment it finishes — not batched at the end.
- **Implement: per task.** As you finish each task in `tasks.md` (the moment you mark its `- [x] **<TaskID>**`), append BOTH a start and a complete for it, each with its own `date -u`: `{ "step": "implement", "substep": "<TaskID>", "task": "<TaskID>", "kind": "start", "by": "ai", "at": "<date -u>" }` then the matching `"kind": "complete"`. One fresh `date -u` per task — do not batch; the per-task cadence is the point. The `task` field lets the end-of-step hook treat already-journaled tasks as a no-op.
- **Never write the next step's start.** Only the next command appends the next step's start entry; writing it here makes the viewer render a phantom "Generating <next>…".
<!-- /speckit-companion:timing -->
