---
id: tasks-doc
kind: author
command: tasks
writes: tasks.md
reads: []
---
1. Read `.specify/feature.json` for the feature directory; load `plan.md` and `spec.md` (required), plus `data-model.md`, `contracts/`, and `research.md` if present.

2. Create `<feature_directory>/tasks.md` organized **by user story**, so each story can be implemented, tested, and delivered as an independent increment. Use the line format `T### [P?] [US#] Description with exact file path`:
   - `[P]` marks a task that can run in parallel — a different file with no incomplete dependency (advisory; same-file or dependent tasks stay ordered).
   - `[US#]` maps the task to a user story from the spec for traceability.

3. Group the tasks into phases, in this order:
   - **Phase 1: Setup** — project structure, config, and tooling prerequisites shared by everything.
   - **Phase 2: Foundational** — core infrastructure that BLOCKS all stories (shared models/types, providers, routing, persistence). Note that no user-story work begins until this phase is done.
   - **Phase 3 onward: one phase per user story**, in priority order (P1 first = the MVP slice). For each story: an optional `### Tests` block (include only when the spec or constitution asks for tests — write them to fail first), then `### Implementation` (models → services → UI → integration), then a **Checkpoint** line stating the story is now independently functional and testable.
   - **Final phase: Polish** — cross-cutting cleanup, docs, and validation against the spec's Success Criteria.

4. End with a **Dependencies & Execution Order** section: the phase dependencies (Setup → Foundational → stories → Polish), the ordering within a story (tests before code; models before services before endpoints), and the parallel opportunities. Each task names the concrete file it creates or edits.

**Output**: `<feature_directory>/tasks.md` organized by user story into dependency-ordered phases.
