---
id: gather-context
kind: investigate
command: plan
reads: []
---
1. Read `.specify/feature.json` for the feature directory; load `<feature_directory>/spec.md` and `.specify/memory/constitution.md` if present. These are the inputs the plan must satisfy: the spec's requirements and the project's constitution gates. Then study the existing codebase the feature attaches to — the patterns it must follow (state/store, routing, persistence, component and test conventions) and the exact files it will touch — so the plan reflects how this project actually builds.
