## Parallel work — default to subagents when your provider supports them

If your provider can spawn subagents (for example Claude Code's Task tool), **make concurrency your default execution strategy, not an optional optimization.** When the capability is there, using it is expected; sequential is the fallback for chat-only hosts, not the comfortable path. Do not default to one-thing-at-a-time just because it feels simpler.

- **Investigation.** Fan out independent reads across subagents (one per area) and return distilled findings, instead of reading every file serially into the main context.
- **Tasks.** Organize `tasks.md` into **waves** — each wave a set of different-file, no-shared-dependency tasks that are parallel by construction. The wave *is* the batch; you don't infer it from inline markers.
- **Implement.** Run the waves in order. For each wave, issue one subagent per task **in a single message** so the whole wave runs concurrently, then let the main agent do the bookkeeping. Do **not** grind through a wave's tasks one at a time. The next wave waits for the current one.

Only when you genuinely cannot spawn subagents, run sequentially — no error, identical artifacts.
