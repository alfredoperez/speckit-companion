---
id: gather-context
kind: investigate
command: plan
reads: []
---
1. Read `.specify/feature.json` for the feature directory; load `<feature_directory>/spec.md` and `.specify/memory/constitution.md` if present — this is what the plan must satisfy.

2. **Investigate the codebase in parallel — this is the default on a host with subagents, not an optional optimization.** Before designing anything, understand where this feature attaches: the existing patterns it must follow and the exact files it will touch. From the spec, derive the handful of **independent investigation areas** this change implicates — for example the state/store pattern for new data, routing/navigation for a new page, the persistence helper for anything saved, component and styling conventions for new UI, and the test setup for new tests.
   - **Fan the investigation out: issue one subagent per area, all in a single message, so they read concurrently.** Each subagent investigates only its area and returns a **distilled finding** — the pattern to copy, the concrete file paths, the conventions to match, and anything surprising — never a dump of file contents. This keeps each area's reading out of the main context and runs them at once; collect the findings as the research basis the plan is built on.
   - Same dependency rules as everywhere: areas that are genuinely independent go in the one fan-out; if one area's answer is needed to even know what else to look at, investigate it first, then fan out the rest. Only a host that cannot spawn subagents reads the areas one at a time — identical result, just slower.

