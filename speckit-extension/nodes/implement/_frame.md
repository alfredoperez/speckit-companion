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

Execute `tasks.md` phase by phase in dependency order. Each phase is laid out as ordered **waves** split by `⟶ Wait …` join lines — a dependency map where tasks within a wave are independent and a `⟶ Wait` marks where the next tasks depend on what came before. Build each task inline, in turn, stopping at each `⟶ Wait` line until the wave above is done. (A host with subagents *may* parallelize a wave whose tasks are each heavy enough to be worth a separate worker, but inline is the default and usually faster for ordinary edits.) Each task's finish is logged as it completes; then mark the spec complete.
