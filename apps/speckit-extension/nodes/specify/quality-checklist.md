---
id: quality-checklist
name: Self-check the spec
kind: author
command: specify
reads: [draft-spec]
---
4. **Self-check the spec once, in place.** Do not write a checklist file. Read `spec.md` against these and fix each fail in the spec. One pass, no rewrite loop:

   - No implementation detail outside **Verbatim Constraints**; written for a non-technical reader.
   - User Scenarios, Functional Requirements and Success Criteria are present.
   - Each requirement is one testable MUST/SHOULD statement with acceptance criteria behind it.
   - Success criteria are measurable and technology-agnostic.
   - Edge cases, scope, dependencies and assumptions are stated.

5. **Settle the open questions before plan.** Scan `spec.md` for `[NEEDS CLARIFICATION: …]` markers. No marker left: ask nothing and move on. Otherwise settle every one here, never leaving one for plan to guess; past three, keep the three that matter most and turn the rest into Assumptions.

   **Attended**: stop and ask them all at once, then wait:

   ```markdown
   | # | What is unresolved | Options |
   |---|---|---|
   | 1 | [the question, in the user's terms] | A. [option] · B. [option] · C. something else |

   **Your choice**: _[wait for the user's response]_
   ```

   Write each answer into the spec in place of its marker, and record it the moment it arrives, keyed by its row so a later answer replaces it. A row the user skips is settled the unattended way below, so no marker survives:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --decision '{"decision": "<the answer, in their terms>", "id": "spec-question-<n>", "by": "you"}'
   ```

   **Unattended** (the dispatched prompt or `.spec-context.json` says `unattended: true`): never ask. Replace each marker with the most reasonable answer, write it under Assumptions, and record one concern per question:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --concern '{"note": "Question <n>: assumed <answer> for: <question>", "step": "specify"}'
   ```
