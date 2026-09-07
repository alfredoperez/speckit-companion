---
id: tasks-doc
name: Write the task list
kind: author
command: tasks
writes: tasks.md
reads: []
---
1. Read `.specify/feature.json` for the feature directory. The step's start is already stamped, above. Load `plan.md` and the feature spec (`<short-name>.spec.md`, or `spec.md` in a project written before this) (required), plus `data-model.md`, `contracts/`, and `research.md` if present.

2. Create `<feature_directory>/tasks.md` organized **by user story**, so each story can be implemented, tested, and delivered as an independent increment. Use the line format `- [ ] **T###** [P?] [US#] Description · exact/file/path`:
   - `[P]` marks a task that is **independent** of the others in its wave — a different file with no incomplete dependency, so it can be built in any order (or in parallel on a host that wants to).
   - `[US#]` maps the task to a user story from the spec for traceability.

3. **Make the dependency structure explicit — group each phase's work into ordered waves, never a flat list.** A reader (human or agent) must see at a glance *which tasks are independent* and *where work has to wait*:
   - A **wave** is a set of tasks that touch different files and don't depend on each other, so they can be built in any order. Head it with a line like `**Wave 1 — independent (different files):**` and tag each of its tasks `[P]`.
   - Between waves, write an explicit join line — `**⟶ Wait for Wave 1 to finish, then:**` — before the tasks that depend on the previous wave. Those form the next wave (or run singly).
   - A wave of one is fine — a single task, no `[P]`. Same-file or dependent tasks are **never** in the same wave. Group every genuinely-independent task of the phase into one wave, so the dependency boundaries are honest.
   This wave layout is the execution map implement reads — it replaces the old scattered-`[P]` list. (Implement builds the tasks inline by default; the wave grouping documents the dependency order and tells a subagent-capable host which tasks *could* run together.)

4. Group the waves into phases, in this order:
   - **Phase 1: Setup** — project structure, config, and tooling prerequisites shared by everything.
   - **Phase 2: Foundational** — core infrastructure that BLOCKS all stories (shared models/types, providers, routing, persistence). No user-story work begins until this phase is done.
   - **Phase 3 onward: one phase per user story**, in priority order (P1 first = the MVP slice). For each story: an optional `### Tests` block (include only when the spec or constitution asks for tests — write them to fail first), then `### Implementation` laid out as waves (foundation/models first, then the independent components/UI wave, then the integration wave), then a **Checkpoint** line stating the story is now independently functional and testable.
   - **Final phase: Polish** — cross-cutting cleanup, docs, and validation against the spec's Success Criteria. **Single-owner validation:** by default this phase generates a task that runs the test/lint suites to validate against the Success Criteria. Skip that suite-run task ONLY when the project has explicitly handed validation to a post-implement hook — read `.specify/companion.yml` and look under `commands.implement.hooks.after.implement-exec` for a hook entry that carries the marker `owns: validation` (the project's explicit statement that this hook runs the Success-Criteria suites). Presence of a hook is NOT the signal — review, PR, and deploy hooks share this same anchor; only the `owns: validation` marker is. When a marked hook is present, emit a deferring task (`- [ ] **T###** Validate against Success Criteria — owned by the project's post-implement validation hook (no separate suite run)`) instead of a second run. With no marked hook (the common case, or `companion.yml` absent/malformed), Polish owns validation and generates the suite-run task as usual. Either way the suites run in exactly one place.

5. **Every file has exactly one owner phase.** Before writing the list, walk the files the plan names and give each to one phase. A file two stories would both touch is either foundational — it goes in Phase 2, built before any story starts — or it is split so each story owns its own file (`enqueue.service.ts` and `replay.service.ts`, not one service both edit); a slice-per-concern layout wants that anyway. Open each story phase with one line, `Files: <the files it owns>`, and name the test files it owns under `### Tests`. The check is one grep: no path appears under two phases. This is what lets implement hand a whole story to a worker without putting two workers on one file.

6. End with a **Dependencies & Execution Order** section: the phase dependencies (Setup → Foundational → stories → Polish) and a one-line restatement of each phase's waves (which wave blocks which). Each task names the concrete file it creates or edits.

7. **Capture the requirement→task map** so "which tasks cover FR-X?" is answerable from the context file (best-effort; skip silently if `python3` is unavailable — the implement step fills each requirement's tests later). Carry each requirement's one-line text as its `title` so the requirement is captured as readable content, not just an id:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step tasks --batch '{
     "coverage": [
       {"req": "FR-001", "title": "<the requirement one-line text>", "tasks": "T001,T004"},
       {"req": "FR-002", "title": "<…>", "tasks": "T005"}
     ],
     "step_summary": {"summary": "<task count + phase shape in one line>"}
   }'
   ```

   **One call, not one per item.** `--batch` takes the whole volley as a single JSON object and applies each writer additively, so the shared context file is read and rewritten once instead of once per entry. A volley issued one flag at a time rewrote 617KB to carry 7KB on one measured run — 89x — and every call is a separate round-trip in your context. Emit one `--batch`.

**Output**: `<feature_directory>/tasks.md` organized by user story into dependency-ordered phases, each phase laid out as explicit waves with join points.
