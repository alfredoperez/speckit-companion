---
id: draft-spec
kind: author
command: specify
writes: spec.md
reads: [resolve-dir]
---
2. Create `<feature_directory>/spec.md` with these sections, in order. Write for a business stakeholder — plain language first, focused on **what** users need and **why**, not **how** to build it. Reserve `inline code` for literal identifiers a reader would copy (real names, routes, keys); never backtick ordinary nouns.

   - **User Scenarios & Testing** *(mandatory)* — the heart of the spec. Capture the feature as **prioritized user stories**, each an independently testable slice that delivers value on its own:
     - `### User Story N - <short title> (Priority: P1|P2|P3)` followed by one plain-language paragraph describing the journey.
     - **Why this priority** — one line on its value and ordering.
     - **Independent Test** — how this story alone can be exercised and what value it proves.
     - **Acceptance Scenarios** — a numbered list of `**Given** … **When** … **Then** …` cases.
     Order P1 first (the MVP slice); add as many stories as the feature genuinely needs.
   - **Edge Cases** — a short list of the boundary and error questions the implementation must answer (empty input, an entity removed while in use, duplicates, reload/persistence).
   - **Requirements › Functional Requirements** *(mandatory)* — a numbered `FR-001…` list; each a single, testable MUST/SHOULD statement. Mark a genuinely unresolvable choice `[NEEDS CLARIFICATION: …]` (max 3; prefer an informed default and record it under Assumptions instead).
   - **Key Entities** *(include when the feature involves data)* — each entity: what it represents, its key attributes and relationships, no implementation detail.
   - **Success Criteria › Measurable Outcomes** *(mandatory)* — measurable, technology-agnostic `SC-001…` outcomes (time, count, percentage, pass/fail). No framework, API, or database names.
   - **Assumptions** — the informed defaults you chose for anything the description left open.

3. Keep it business-readable. Every vague requirement should fail a "testable and unambiguous" check — tighten it. Remove a section that genuinely does not apply rather than leaving it as "N/A".
