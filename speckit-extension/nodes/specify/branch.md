---
id: branch
kind: control
command: specify
reads: [classify-size]
---
6. **Branch on the verdict.**

   - **`simple` — minimal mode.** Write **three lean files** in this one pass so the file-driven views (top stepper, sidebar, implement progress) reconcile with the history-driven fold — never a single combined `spec.md`:
     - Append an **Approach** section to the already-written `spec.md` — the files to touch and any dependencies, in a few bullets (the plan content, inline; this stays the plan source-of-truth).
     - Write `<feature_directory>/plan.md` as a **short pointer** to the spec's Approach (e.g. a one-line blockquote linking `./spec.md#approach` and `./tasks.md`). Do **not** duplicate the approach bullets — `plan.md` references them.
     - Write `<feature_directory>/tasks.md` carrying the **real task checklist** — a dependency-ordered list, one per line as `- [ ] **T001** [P?] <description> + <path>` (`[P]` marks tasks that can run in parallel). This MUST be the actual checklist, not a pointer: implement progress counts these checkboxes, so a pointer would read 0/0.

     Put the task checklist **only** in `tasks.md` — do **not** keep a second copy in `spec.md` (the duplicate would drift). `spec.md` keeps the Approach; `tasks.md` owns the tasks.

     Still write `<feature_directory>/checklists/requirements.md` as in step 4. Do **not** run `/speckit.companion.plan` or `/speckit.companion.tasks` — the three lean files plus the lifecycle fold below record those steps as satisfied.
   - **`normal` — full pipeline.** Write `spec.md` only (no appended Approach section, no `plan.md` / `tasks.md` here, no lifecycle fold). The existing pipeline continues unchanged: plan and tasks are produced and recorded by their own `/speckit.companion.plan` and `/speckit.companion.tasks` runs.

