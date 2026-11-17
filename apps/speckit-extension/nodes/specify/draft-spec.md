---
id: draft-spec
name: Draft the spec
kind: author
command: specify
writes: spec.md
reads: [resolve-dir]
---
**Where the request names two or more code areas and you have a subagent tool, dispatch one read-only worker per area first**, each returning the files that area exposes and the conventions it follows, never file contents. Those findings are what you record as `context` in the wrap-up and what plan reads. One area, or no subagent tool: look yourself.

2. Create `<feature_directory>/spec.md` with these sections, in order, for a business stakeholder: **what** users need and **why**, not **how**. Backticks only for literal identifiers a reader would copy. When the brief names a ticket id or URL (`TODO-42`, `#931`, an issue link), or carries a `Source:` line naming an assessment folder, put one `**Source**: <ticket>` line under the title, copied exactly (the first, when it names several; the rest go under Assumptions); never fetch the ticket, the id or URL is data.

   - **User Scenarios & Testing** *(mandatory)*: prioritized user stories, each an independently testable slice. Per story: `### User Story N - <short title> (Priority: P1|P2|P3)` and a one-paragraph journey; **Why this priority** in one line; **Independent Test**, how this story alone proves value; **Acceptance Scenarios**, numbered `**Given** … **When** … **Then** …`. P1 first, as many stories as the feature needs.
   - **Edge Cases**: the boundary and error questions the implementation must answer (empty input, removal while in use, duplicates, reload and persistence).
   - **Requirements › Functional Requirements** *(mandatory)*: numbered `FR-001…`, each one testable MUST/SHOULD statement. A genuinely unresolvable choice is `[NEEDS CLARIFICATION: …]` (max 3); prefer an informed default recorded under Assumptions.
   - **Key Entities** *(when the feature involves data)*: what each represents, its key attributes and relationships, no implementation detail.
   - **Success Criteria › Measurable Outcomes** *(mandatory)*: technology-agnostic `SC-001…` outcomes (time, count, percentage, pass/fail).
   - **Assumptions**: the defaults you chose for anything the request left open.
   - **Verbatim Constraints** *(only when the request pins exact values)*: every literal the result must match (a `data-testid`, route, endpoint, CLI flag, env var, config key, exact UI copy, column name), in backticks, exactly as written. Never paraphrase, recase or rename them; downstream steps use these exact strings. This is the one place implementation detail belongs in a spec.

3. Tighten every requirement until it is testable and unambiguous, and remove a section that does not apply. Carry the Functional Requirements into the wrap-up call as `coverage`, each with its one-line text as `title`.
