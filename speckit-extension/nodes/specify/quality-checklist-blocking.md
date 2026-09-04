---
id: quality-checklist-blocking
name: Quality checklist, blocking
kind: gate
command: specify
writes: checklists/requirements.md
reads: [draft-spec]
---
4. **Spec quality checklist, run as a gate.** Write `<feature_directory>/checklists/requirements.md` using the template below, then validate and **loop**: grade each item pass/fail, fix the fails in `spec.md`, and re-run the validation. Up to **three** iterations.

   After the third — or sooner, if what remains needs a decision only the user can make — **stop and ask.** Present the unresolved items as a numbered table with the options for each, and wait for an answer before continuing:

   | # | What is unresolved | Options |
   |---|---|---|
   | 1 | [the ambiguity, in the user's terms] | A. [option] · B. [option] · C. something else |

   **Your choice**: _[wait for the user's response]_

   Do not proceed to the next step on an unanswered table. This is the fork with the advisory checklist: that one records what it could not settle and moves on, deferring to `clarify`; this one holds the step until the spec is clean. Pick it when a wrong spec is more expensive than a slow one.

   ```markdown
   # Specification Quality Checklist: [FEATURE NAME]

   **Purpose**: Validate specification completeness before planning
   **Created**: [DATE]
   **Feature**: [Link to spec.md]

   ## Content Quality

   - [ ] No implementation details (languages, frameworks, APIs)
   - [ ] Focused on user value and business needs
   - [ ] Written for non-technical stakeholders
   - [ ] All mandatory sections completed (User Scenarios, Requirements, Success Criteria)

   ## Requirement Completeness

   - [ ] No [NEEDS CLARIFICATION] markers remain
   - [ ] Each Functional Requirement is a single, testable MUST/SHOULD statement
   - [ ] Success criteria are measurable
   - [ ] Success criteria are technology-agnostic (no implementation details)
   - [ ] All acceptance scenarios are defined
   - [ ] Edge cases are identified
   - [ ] Scope is clearly bounded
   - [ ] Dependencies and assumptions identified

   ## Feature Readiness

   - [ ] All functional requirements have clear acceptance criteria
   - [ ] User scenarios cover primary flows
   - [ ] Feature meets measurable outcomes defined in Success Criteria
   - [ ] No implementation details leak into the specification

   ## Notes

   - Every item passes, or the step stops here.
   ```
