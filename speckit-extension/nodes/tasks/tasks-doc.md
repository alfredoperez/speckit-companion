---
id: tasks-doc
kind: author
command: tasks
writes: tasks.md
reads: []
---
1. Read `.specify/feature.json` for the feature directory; load `plan.md` and `spec.md` (and `data-model.md` / `contracts/` if present).

2. Create `<feature_directory>/tasks.md` as a dependency-ordered checklist. Group by execution layer, not by story:
   - **Setup** — project/structure/config prerequisites.
   - **Foundational** — shared pieces every later task depends on (blocking).
   - **Core work** — one task per file/module/unit, ordered so dependencies come first.
   - **Integration** — wiring the units together.
   - **Polish** — docs, cleanup, validation against the spec's Success Criteria.

3. Every task uses the strict format:
   ```text
   - [ ] [TaskID] [P?] Description with exact file path
   ```
   - `[P]` marks tasks touching different files with no incomplete dependency (parallelizable).
   - Each task names the concrete file it creates or edits.
   - No user-story labels, no per-story test sections, no MVP framing — traceability is to files and requirements (`FR-…`).

4. Add a short **Dependencies** note (what blocks what) and a **Parallel** note (which `[P]` tasks can run together).

**Output**: `<feature_directory>/tasks.md` organized by files/dependencies.


