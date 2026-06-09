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

These rules apply to every Companion profile command. The extension records lifecycle timing with its own scripts wherever it can; these rules keep anything you append consistent with that and accurate for any dispatcher (terminal, IDE chat, or the GUI).

- **Live timestamps.** When you append a history entry yourself, stamp it by running `date -u +"%Y-%m-%dT%H:%M:%SZ"` at that moment. Never hand-type a timestamp, never reuse an earlier value, never stamp several entries with one shared value.
- **Self-close — but not specify or implement.** When your own work for **plan, tasks, clarify, or analyze** ends, append `{ "step": "<this step>", "substep": null, "kind": "complete", "by": "ai", "at": "<date -u output>" }`. Do NOT self-close **specify** or **implement**: the extension closes those itself (specify from its own command, implement from the end-of-step hook), so an `ai` complete there would duplicate it.
- **Substeps live.** For each substep boundary, append its own entry with that substep name and its own fresh `date -u` the moment it finishes — not batched at the end.
- **Implement: do not journal timing.** Just mark each task `- [x] **<TaskID>**` in `tasks.md` as you finish it and append `task_summaries.<TaskID>`. The end-of-step hook records every task's start + complete and the implement step's end — leave all implement timing to it.
- **Never write the next step's start.** Only the next command appends the next step's start entry; writing it here makes the viewer render a phantom "Generating <next>…".
<!-- /speckit-companion:timing -->
