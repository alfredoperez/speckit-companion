---
id: side-files
kind: author
command: plan
reads: [plan-doc]
---
4. **Phase 0 — Research (first).** Write `<feature_directory>/research.md` before the Phase 1 docs, since they build on its decisions. *(The size budget above governs: at `simple` size, fold the rationale into a short Key Decisions note in `plan.md` instead of a separate `research.md`.)* For each genuine unknown the plan leaves open — a stack or dependency choice the codebase doesn't already settle, an integration, or a significant design choice — record a short entry as **Decision** (what you chose) / **Rationale** (why) / **Alternatives considered** (what else, and why not). Resolve every `NEEDS CLARIFICATION` here — this is where a maintainer sees *why* the design is shaped this way.

5. **Phase 1 — Design & contracts.** With research settled, generate the design artifacts the size budget keeps. They are **independent documents that share no evolving state**, so write them in any order. Inline (one after another) is the default — composing a short design doc is light work that doesn't pay back a separate worker's startup. Only when the documents are genuinely large *and* your host has subagents is it worth generating them concurrently (one subagent per document); the result is identical either way.
   - `<feature_directory>/data-model.md` — the entities this feature introduces or reshapes: fields, relationships, validation rules drawn from the requirements, and any state transitions.
   - `<feature_directory>/contracts/` — the interface the feature exposes (API / CLI / schema, or a UI contract listing routes and the identifiers a consumer/test codes against). **Copy every identifier from the spec's Verbatim Constraints exactly — never rename, recase, pluralize, or invent an identifier the spec already pinned; those exact strings *are* the contract.** Skip the directory only when the feature exposes no interface at all.
   After the documents return, re-check the Constitution Check against the final design.

**Output**: `<feature_directory>/plan.md` plus `research.md`, `data-model.md`, and `contracts/` when applicable.
