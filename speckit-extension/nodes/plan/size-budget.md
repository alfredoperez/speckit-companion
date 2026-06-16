---
id: size-budget
kind: control
command: plan
reads: []
---
**Right-size this plan to the change.** Before anything else, read the recorded size from the spec's context — `.spec-context.json` → the `size` field (treat a missing value as `normal`). That size sets the budget for the steps below; **apply it to them, omitting anything it says to skip.**

- **`normal` or `oversized`** — produce the full plan and every design artifact exactly as the steps describe. No trimming.
- **`simple`** — a small change does not need the full ceremony. Produce a **lean** plan:
  - `plan.md`: keep the **Summary** only. **Skip the Project Structure section** (the task list already names every file) and **skip the Constitution Check** unless there is a real violation to flag.
  - **Skip `data-model.md`** — fold the one or two types into the plan's prose.
  - Write the design rationale as a short **Key Decisions** note folded into `plan.md` (a few Decision/why lines), not a separate `research.md`, unless a decision genuinely needs its own page.
  - Generate `contracts/` only if the feature exposes an interface a consumer or test codes against.

This budget governs every step that follows. Where a later step would produce something the budget skips, omit it — do not produce it and then delete it.
