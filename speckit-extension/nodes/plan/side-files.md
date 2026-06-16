---
id: side-files
kind: author
command: plan
reads: [plan-doc]
---
4. **Phase 0 — Research.** Write `<feature_directory>/research.md`. For each unknown in Technical Context and each significant dependency, integration, or design choice, record a short entry as **Decision** (what you chose) / **Rationale** (why) / **Alternatives considered** (what else, and why not). Resolve every `NEEDS CLARIFICATION` here. This is where the architecture decisions and their trade-offs are captured, so a maintainer can see *why* — don't skip it.

5. **Phase 1 — Design & contracts.** With research settled, generate the design artifacts:
   - `<feature_directory>/data-model.md` — the entities this feature introduces or reshapes: fields, relationships, validation rules drawn from the requirements, and any state transitions.
   - `<feature_directory>/contracts/` — the interface the feature exposes (API / CLI / schema, or a UI contract listing routes and the identifiers a consumer/test codes against). Skip only when the feature exposes no such interface.
   - `<feature_directory>/quickstart.md` — only when there is a non-obvious setup or verification path a developer would otherwise miss; skip it rather than restating what's already obvious.
   Then re-check the Constitution Check against the final design.

**Output**: `<feature_directory>/plan.md` plus `research.md`, `data-model.md`, `contracts/`, and `quickstart.md` when applicable.
