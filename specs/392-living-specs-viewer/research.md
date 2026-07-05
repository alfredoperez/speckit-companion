# Research: Living specs render readably in the viewer

## Decision 1 — Enrich at the provider seam, keep derivation pure

**Decision**: A new `livingSpecsContent.ts` loads capability content with filesystem access; `specViewerProvider` merges it into the `livingSpecs` slice after `deriveViewerState` returns. `deriveViewerState` and `pickLivingSpecs` stay untouched.
**Rationale**: The provider already follows this pattern (the call site injects impure data "into the otherwise-pure derivation"); derivation tests stay filesystem-free.
**Alternatives considered**: Threading a reader into the derivation — rejected, breaks its purity contract; webview-side fetching via messages — rejected, the panel renders from one state snapshot everywhere else.

## Decision 2 — Reuse `readLivingSpecs` for resolution; parse the writer's own document shape

**Decision**: Capability names resolve through `readLivingSpecs(workspaceRoot)` (centralized + colocated rules, `isPathWithinRoot` guard). The parser targets exactly what the fold-back writer emits and maintains: title line (`# <Title> — Living Spec`), optional intro paragraph before `## Requirements` (rendered as the purpose), and `### <heading>` requirement blocks whose first body paragraph becomes the row text (matching `_REQ_HEADING_RE` / `_living_requirement_span` semantics in `write-context.py`).
**Rationale**: One resolver (FR-002) and a parser aligned with the only writer of the format — the TS side mirrors the Python span rules so both ends agree on what a "requirement" is.
**Alternatives considered**: A general markdown renderer — rejected, the spec demands structured rows, not formatted markdown; a second resolver — rejected outright by FR-002.

## Decision 3 — Markdown markers stripped with a minimal inline cleaner

**Decision**: Requirement/purpose text passes through a small strip function (bold/italic/backtick markers removed, links reduced to their text) before entering viewer state; the webview renders plain text nodes.
**Rationale**: The card promises readable text, not a renderer; stripping at the parse boundary keeps the webview injection-safe and dumb.
**Alternatives considered**: Shipping markdown-it output as HTML — rejected (injection surface + design-language mismatch).

## Decision 4 — Delta summary parsed from the feature spec's delta blocks, counts only

**Decision**: For synced capabilities, the loader scans the feature's `spec.md` for `## ADDED/MODIFIED/REMOVED/RENAMED Requirements` blocks (honoring `<!-- capability: <name> -->` markers, defaulting to the most-specific capability like the fold script) and records per-kind counts. No delta body content in this pass.
**Rationale**: Counts answer "what did the fold change" at a glance and match the fold script's targeting rules; block bodies would duplicate the feature spec the viewer already shows.
**Alternatives considered**: Rendering full before/after diffs — rejected as scope creep; reading git history for the fold commit — rejected, fragile and slow.

## Decision 5 — Size cap and failure shape

**Decision**: Reads cap at 256 KB per capability file; a missing, unreadable, out-of-root, or oversized file yields `{ name, available: false }` and the card renders the name with a quiet "content unavailable" note. Config absent or disabled → names-only view exactly as today.
**Rationale**: The viewer must never hang or throw on workspace data; absent-fields-over-zeroes is the panel's established degradation idiom.
**Alternatives considered**: Truncating oversized files at the cap — rejected for this pass (a partial spec reads as a lie; the note is honest).

## Decision 6 — Fixtures split: Storybook carries the rich state, the demo spec carries the degraded state

**Decision**: `specs/_03_demo-living/` commits a context with `livingSpecs.loaded/synced` names so the real viewer exercises resolution-miss degradation (this repo has no living-specs config by explicit user decision); the rich content and delta states live in `LivingSpecsCard.stories.tsx` payloads.
**Rationale**: The user pinned fixtures-only verification with the repo's config untouched — in a config-less workspace the only honestly reachable real-viewer state *is* the degraded one, and it's a required state (US3) worth a standing fixture.
**Alternatives considered**: Enabling living specs here (declined by the user); a spec-dir-local config (no such mechanism — config is workspace-level by design).
