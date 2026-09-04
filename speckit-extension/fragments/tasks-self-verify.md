---
name: Self-verifying tasks
section: Format: `[ID] [P?] [Story] Description`
for: tasks
summary: Every task states how to verify itself, in its own line — no separate verification pass.
---

`[ID] [P?] [Story] Description — verify: <how you know it worked>`

- **[ID]** — `T001`, `T002`, in execution order.
- **[P]** — can run in parallel with its neighbours (different files, no shared state).
- **[Story]** — the user story or requirement this serves.
- **verify:** — **required on every task.** The command, test, or observable
  behaviour that says this task is done. Not "tests pass" in general: the one
  check that would fail if only this task were wrong.

Examples:

```
T004 [P] [US1] Add the starred column to the todo store — verify: store unit tests cover the default false
T005 [US1] Render the star control on each row — verify: clicking a star flips it and it survives a reload
```

A task whose verification you cannot name is a task that is not specified yet.
Write a separate verification task only when the check spans several tasks —
an integration path no single one of them proves.
