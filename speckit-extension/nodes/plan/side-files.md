---
id: side-files
kind: author
command: plan
reads: [plan-doc]
---
4. **Phase 0 — Research (first).** Write `<feature_directory>/research.md` before the Phase 1 docs, since they build on its decisions. For each unknown in Technical Context and each significant dependency, integration, or design choice, record a short entry as **Decision** (what you chose) / **Rationale** (why) / **Alternatives considered** (what else, and why not). Resolve every `NEEDS CLARIFICATION` here — this is where a maintainer sees *why* the design is shaped this way.

5. **Phase 1 — Design & contracts (in parallel).** With research settled, generate the design artifacts the size budget keeps. They are **independent documents that share no evolving state**, so — when your provider can spawn subagents — **generate them concurrently: issue one subagent per document in a single message, then collect the results.** A host without subagents writes them in sequence for an identical result.
   - `<feature_directory>/data-model.md` — the entities this feature introduces or reshapes: fields, relationships, validation rules drawn from the requirements, and any state transitions.
   - `<feature_directory>/contracts/` — the interface the feature exposes (API / CLI / schema, or a UI contract listing routes and the identifiers a consumer/test codes against). **Copy every identifier from the spec's Verbatim Constraints exactly — never rename, recase, pluralize, or invent an identifier the spec already pinned; those exact strings *are* the contract.** Skip the directory only when the feature exposes no interface at all.
   - `<feature_directory>/quickstart.md` — only when there is a non-obvious setup or verification path a developer would otherwise miss; skip it rather than restating what's already obvious.
   After the documents return, re-check the Constitution Check against the final design.

**Output**: `<feature_directory>/plan.md` plus `research.md`, `data-model.md`, `contracts/`, and `quickstart.md` when applicable.
