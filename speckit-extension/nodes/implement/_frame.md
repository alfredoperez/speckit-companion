---
description: "Companion implement — execute tasks.md in dependency order, then mark complete"
---

## User Input

```text
$ARGUMENTS
```

<!-- speckit-companion:part speckit-hooks -->

<!-- /speckit-companion:part speckit-hooks -->

## Outline

Execute `tasks.md` phase by phase in dependency order. Each phase is laid out as ordered **waves** (`Wave N — parallel …` blocks split by `⟶ Wait …` join lines). **Build each wave all at once by spawning one subagent (Task tool) per task in that wave, in a single message — that is how a wave runs, not an optional optimization; doing them one at a time yourself is the fallback only when no subagent tool exists. Stop at each `⟶ Wait` line until the wave above finishes, then go on.** Each task's finish is logged as it completes; then mark the spec complete.
