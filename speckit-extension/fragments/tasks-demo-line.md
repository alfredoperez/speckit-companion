---
name: Demo line per task
section: Format: `[ID] [P?] [Story] Description`
for: tasks
summary: Each task carries a Demo line — what you could show someone once it lands.
---

`[ID] [P?] [Story] Description`
`  Demo: <what you could show someone once this lands>`

- **[ID]** — `T001`, `T002`, in execution order.
- **[P]** — can run in parallel with its neighbours.
- **[Story]** — the user story or requirement this serves.
- **Demo:** — one sentence a person could act on without reading the diff.
  Something visible: a screen, a command and its output, a behaviour that
  changed. Not "the function exists".

Example:

```
T007 [US1] Add the Starred filter to the list header
  Demo: pick Starred and the list shows only starred todos
```

A task with no demo is either too small to be its own task, or it is scaffolding
that belongs folded into the task it serves. The exception is a task whose whole
purpose is internal — say so in the demo line rather than leaving it blank:
`Demo: nothing visible yet — unblocks T009`.
