---
id: tasks-doc
kind: author
command: tasks
writes: tasks.md
reads: []
---
1. Read `.specify/feature.json` for the feature directory; load `plan.md` and `spec.md` (and `data-model.md` / `contracts/` if present).

2. Build the dependency graph, then **level it into waves**. A wave is a set of tasks that can all run at the same time — they touch different files and none depends on another in the same wave. Wave 1 is everything with no prerequisite; Wave 2 is everything whose prerequisites are all in Wave 1; and so on. This is how `tasks.md` is organized — by waves, not by a flat list and not by user story. Waves are parallel **by construction**, so implement can fan them out without re-deriving batches from inline markers.

3. Write `<feature_directory>/tasks.md`. Open with one line: tasks run wave by wave; every task in a wave runs concurrently, and a wave starts only after the one before it finishes. Then emit each wave as a section:
   ```text
   ## Wave 1 — <short label> (parallel)
   - [ ] T001 Description with exact file path
   - [ ] T002 Description with exact file path
   ```
   - Header is `## Wave N — <label>`; the label hints at the work (Setup, Types, Components, Integration, Polish). Add `(parallel)` when the wave has more than one task.
   - Every task line is `- [ ] T### Description with the exact file it creates or edits`. Keep the `T###` id right after the checkbox. **Do not** put `[P]` markers on tasks — the wave already means "parallel"; a single-task wave means "alone".
   - Each task touches **one** file. Two tasks in the same wave must never touch the same file. A task that depends on another's output goes in a later wave (or its own single-task wave if nothing can run beside it).
   - Prefer wide waves: when an implementation file and its test have a stable contract, put **both in the same wave** (one subagent writes `Foo.tsx`, another writes `Foo.test.tsx`). Independent components, independent helpers, and a file + its co-located test are the common same-wave pairings.
   - **When same-wave tasks share an interface, write the interface ONCE as a wave `> Contract:` line, not twice in two task descriptions.** Concurrent subagents can't see each other's files, so two descriptions that each *describe* the same shape are exactly where they drift (a default-vs-named export, a handler named two ways). Put a single `> Contract:` note right under the wave header that every task in the wave — and the implement step's subagents — follows verbatim: the **export shape** (default to a **named export** unless the codebase convention is otherwise — that alone removes the most common drift), the exact **signature** (props/params/return), and the **names** of any shared handlers or test attributes. Example: `> Contract: \`useTags()\` (named export from \`src/store/tags.tsx\`) → \`{ tags: Tag[]; addTag(name: string): void; removeTag(id: string): void }\`.`
   - **Keep a tight producer→consumer chain in one task, not a same-wave fan-out.** When several files just thread the *same new prop* through a render tree (page → list → row), one collision in the shared shape can't be self-healed by concurrent agents — write the chain as a **single coherent task** one subagent owns end to end. Reserve same-wave splitting for files that are genuinely independent.
   - No user-story labels, no per-story test sections, no MVP framing — traceability is to files and requirements (`FR-…`).

4. End with a short **Dependencies & waves** note: one line per wave saying what it needs from earlier waves, and call out any same-wave pair that shares a pinned contract.

**Output**: `<feature_directory>/tasks.md` organized into dependency-leveled parallel waves.


