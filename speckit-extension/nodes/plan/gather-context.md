---
id: gather-context
kind: investigate
command: plan
reads: []
---
1. Read `.specify/feature.json` for the feature directory; load `<feature_directory>/spec.md` and `.specify/memory/constitution.md` if present — the inputs the plan must satisfy. Then **investigate the codebase, in parallel when you can.** Understand where this feature attaches: the patterns it must follow (state/store, routing, persistence, component and test conventions) and the exact files it will touch. From the spec, derive the handful of **independent investigation areas** this change implicates, then — when your provider can spawn subagents — **read them concurrently: one subagent per area in a single message, each returning a distilled finding** (the pattern to copy, the concrete file paths, the conventions to match), never a dump of file contents. Collect the findings as the research basis for the plan. A host without subagents reads the areas in sequence for an identical result.
