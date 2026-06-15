---
id: plan-doc
kind: author
command: plan
writes: plan.md
reads: [gather-context]
---
2. Create `<feature_directory>/plan.md` with these sections, in order:
   - **Summary** — the primary requirement plus the technical approach in 2–4 sentences.
   - **Technical Context** — language/version, primary dependencies, storage, testing, target platform, hard constraints. Mark unknowns `NEEDS CLARIFICATION`.
   - **Approach & Structure** — the concrete files/modules this touches (real paths) and the order of attack. Organize by file/dependency, not by user story. (This replaces the stock Project Structure trees.)
   - **Out of Scope** — what this explicitly does not do.

