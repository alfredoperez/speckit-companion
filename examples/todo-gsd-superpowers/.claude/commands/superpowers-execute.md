---
description: Execute the current GSD phase plan with Superpowers instead of gsd-execute-phase
---

Take the current GSD phase plan in `.planning/` (the most recent `*-PLAN.md`, or the
phase directory passed as `$ARGUMENTS`) and hand it to Superpowers:

1. Use the **writing-plans** skill to turn the GSD phase plan into a Superpowers
   implementation plan.
2. Execute that plan with **subagent-driven-development**: strict TDD, a fresh
   subagent per task, two-stage review per task.

Do NOT use /gsd-execute-phase — Superpowers is the execution layer in this workflow.
When execution finishes, report which plan items are done so /gsd-verify-work can run.
