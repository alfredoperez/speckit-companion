---
id: gather-context
kind: investigate
command: plan
reads: []
---
1. Read `.specify/feature.json` for the feature directory; load `<feature_directory>/spec.md` and `.specify/memory/constitution.md` if present.

2. If you support subagents, fan these reads out in parallel (one per area) and collect findings; otherwise read sequentially.

