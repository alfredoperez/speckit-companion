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

Execute `tasks.md` phase by phase in dependency order. **Within each phase, build the independent (`[P]`) tasks in parallel: spawn one subagent (Task tool) per `[P]` task, all in a single message, so they run at once — this is the default on a host that has subagents, not an optional optimization. Doing them one at a time yourself is the fallback only when no subagent tool exists.** Each task's finish is logged the moment it completes; then mark the spec complete.
