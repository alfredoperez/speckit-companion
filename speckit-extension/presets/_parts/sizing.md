- **small** — the change plausibly touches **≤ 5 files** and decomposes into **≤ 10 tasks**.
- **oversized** — the change clearly exceeds the small bar by a wide margin (broad multi-subsystem
  work, many new files, or a long task list).
- **normal** — anything in between (the default).

The two constants (5 files / 10 tasks) are the same guardrail the old `complexityFastPath` used.
