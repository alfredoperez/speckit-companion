---
id: quality-checklist
name: Self-check the spec
kind: author
command: specify
reads: [draft-spec]
---
4. **Self-check the spec once, in place.** Do not write a checklist file. Read `spec.md` against these, fix each fail in the spec, and leave a genuine ambiguity as a `[NEEDS CLARIFICATION: …]` marker (max 3) for `clarify`. One pass, no rewrite loop, no option tables:

   - No implementation detail outside **Verbatim Constraints**; written for a non-technical reader.
   - User Scenarios, Functional Requirements and Success Criteria are present.
   - Each requirement is one testable MUST/SHOULD statement with acceptance criteria behind it.
   - Success criteria are measurable and technology-agnostic.
   - Edge cases, scope, dependencies and assumptions are stated.
