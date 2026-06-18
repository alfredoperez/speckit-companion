---
id: gather-context
kind: investigate
command: plan
reads: []
---
1. Read `.specify/feature.json` for the feature directory; load `<feature_directory>/spec.md` and `.specify/memory/constitution.md` if present — the inputs the plan must satisfy. Then **investigate the codebase** to understand where this feature attaches: the patterns it must follow (state/store, routing, persistence, component and test conventions) and the exact files it will touch. Read inline by default. **The exception worth parallelizing:** a *large or unfamiliar* codebase with several **independent areas** to map — there, reading is genuinely heavy (each area means opening many files), so when your host has subagents, dispatch one read-only subagent per area in a single message, each returning a **distilled finding** (the pattern to copy, the concrete file paths, the conventions to match) rather than a dump of file contents. That is the case where a separate worker pays for its startup. For a small or familiar codebase, just read the areas yourself in turn — identical result, less overhead. Collect the findings as the research basis for the plan.
