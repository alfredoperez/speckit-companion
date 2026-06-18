---
id: size-budget
kind: control
command: tasks
reads: []
---
**Right-size this task list to the change.** Before drafting, read the recorded size from the spec's context — `.spec-context.json` → the `size` field (treat a missing value as `normal`). **Apply the budget to the step below, omitting anything it says to skip.**

- **`normal` or `oversized`** — produce the full phased task list exactly as the step describes. No trimming.
- **`simple`** — a small change needs the tasks, not the ceremony around them. Produce a **lean** list:
  - **No baseline/setup task** for "run install/build to confirm green" — that is not real work.
  - Group by phase still (Setup if any → Foundational → the work → Polish), but **drop the per-story `Goal` / `Independent Test` / `Checkpoint` blocks** — a small change ships in one pass, not as separate demoable slices.
  - End with a **one-line** dependency note (what blocks what), **not** the full "Dependencies & Execution Order" + "Parallel Opportunities" prose.
  - Keep every task line precise (the `T###`, the exact file, the requirement) — trim the framing, never the tasks themselves.

This budget governs the step that follows. Where it would produce something the budget skips, omit it.
