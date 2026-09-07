---
description: "Companion implement — execute tasks.md in dependency order, then mark complete"
---

## User Input

```text
$ARGUMENTS
```

<!-- speckit-companion:part step-start -->

<!-- /speckit-companion:part step-start -->

<!-- speckit-companion:part speckit-hooks -->

<!-- /speckit-companion:part speckit-hooks -->

<!-- speckit-companion:part smallest-thing -->

<!-- /speckit-companion:part smallest-thing -->

## Outline

Execute `tasks.md` phase by phase in dependency order. Each phase is laid out as ordered **waves** split by `⟶ Wait …` join lines — a dependency map where tasks within a wave are independent and a `⟶ Wait` marks where the next tasks depend on what came before. Setup, the foundational phase and polish are built inline, wave by wave, stopping at each `⟶ Wait` line until the wave above is done; each user-story phase goes to its own worker wherever a subagent tool exists, and inline is the fallback for a host that cannot dispatch. Each task's finish is logged as it completes; then mark the spec complete.
