---
description: "Companion plan — lean plan.md"
---

## User Input

```text
$ARGUMENTS
```

## Outline

Produce a **lean** plan — just enough to drive tasks. No multi-phase research scaffolding, no dual-option structure trees.

<!-- speckit-companion:part parallel -->
## Parallel work — use subagents where your provider supports them

If you can spawn subagents or run work concurrently, use that capability across this step:

- **Investigation.** Fan out independent reads across subagents (one per area) and return distilled findings, instead of reading every file serially into the main context.
- **Tasks.** Mark independent (different-file, no open dependency) tasks `[P]` so they can run together.
- **Implement.** Run `[P]` batches concurrently via subagents; same-file or dependent tasks stay ordered.

If you cannot spawn subagents, do all of it sequentially — no error, identical output. This is a capability suggestion, not a requirement: a chat-only host simply runs the step the slow way and produces the same artifacts.
<!-- /speckit-companion:part parallel -->

