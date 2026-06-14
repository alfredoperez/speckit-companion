---
id: quality-checklist
kind: author
command: specify
writes: checklists/requirements.md
reads: [draft-spec]
---
4. **Spec quality checklist.** Write `<feature_directory>/checklists/requirements.md` using the template below, then run a **single** self-check pass: grade each item pass/fail, fix obvious fails in `spec.md` in place, and leave any genuine ambiguity as a `[NEEDS CLARIFICATION: …]` marker (max 3) for the `clarify` step. Do **not** run a multi-iteration rewrite loop or prompt the user with option tables — Companion defers interactive clarification to `clarify`. Update the checklist to reflect the final pass/fail state.

   ```markdown
   # Specification Quality Checklist: [FEATURE NAME]

   **Purpose**: Validate Companion specification completeness before planning
   **Created**: [DATE]
   **Feature**: [Link to spec.md]

   ## Content Quality

   - [ ] No implementation details (languages, frameworks, APIs)
   - [ ] Focused on user/business value and the change's intent
   - [ ] Overview states what is delivered and why in 1–3 sentences
   - [ ] All four sections present (Overview, Functional Requirements, Success Criteria, Assumptions)

   ## Requirement Completeness

   - [ ] Any [NEEDS CLARIFICATION] markers are genuine ambiguities (≤3) deferred to clarify — not unresolved guesses
   - [ ] Each Functional Requirement is a single, testable MUST/SHOULD statement
   - [ ] Success criteria are measurable
   - [ ] Success criteria are technology-agnostic (no implementation details)
   - [ ] Edge cases are folded into Functional Requirements or Assumptions
   - [ ] Scope is clearly bounded
   - [ ] Dependencies and assumptions identified

   ## Feature Readiness

   - [ ] Every Functional Requirement maps to at least one Success Criterion
   - [ ] Overview intent is reflected by the FR list (no orphan goals)
   - [ ] No implementation details leak into the specification

   ## Notes

   - Items marked incomplete require spec updates before clarify or plan
   ```

