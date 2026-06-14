---
id: draft-spec
kind: author
command: specify
writes: spec.md
reads: [resolve-dir]
---
2. Create `<feature_directory>/spec.md` with exactly these sections, in order:
   - **Overview** — 1–3 sentences: what this delivers and why. No implementation detail. (This replaces the stock user-scenarios narrative.)
   - **Functional Requirements** — a numbered `FR-001…` list. Each requirement is a single, testable MUST/SHOULD statement. Mark a genuinely unresolvable choice with `[NEEDS CLARIFICATION: …]` (max 3; prefer informed defaults).
   - **Success Criteria** — measurable, technology-agnostic `SC-001…` outcomes (time, count, percentage, pass/fail). No framework or API names.
   - **Assumptions** — the informed defaults you chose for anything unspecified.

3. Keep it business-readable. Do **not** add user stories, acceptance-scenario tables, or priority labels — Companion tracks requirements and outcomes directly. Fold edge cases into Functional Requirements or Assumptions.

