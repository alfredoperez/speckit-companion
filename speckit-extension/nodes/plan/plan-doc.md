---
id: plan-doc
kind: author
command: plan
writes: plan.md
reads: [gather-context]
---
2. Create `<feature_directory>/plan.md` with these sections, in order. Lead each with prose; reserve `inline code` for real identifiers (paths, types, packages), not ordinary nouns — a sentence that is mostly code spans is a rewrite.
   - **Summary** — 2–4 plain-language sentences: the primary requirement plus the technical approach.
   - **Technical Context** — the stack as plain `Label: value` lines, each named once: Language/Version, Primary Dependencies, Storage, Testing, Target Platform, Project Type, Performance Goals, Constraints, Scale/Scope. Mark a genuine unknown `NEEDS CLARIFICATION`. Keep the values readable — don't backtick every noun.
   - **Project Structure** — the concrete source layout this feature touches, as a short tree of real directories/files, plus a one-line **Structure Decision**. Use the actual paths; do not leave placeholder option-trees in the output.
