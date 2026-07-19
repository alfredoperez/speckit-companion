# Research: Living Spec Header

## Decision — Take the title from the document's first heading

**Decision**: Add a helper beside the other living-spec viewer helpers that reads a living spec's first level-one heading, strips a trailing "— Living Spec" style suffix, and returns it. When there is no usable heading, return the existing location-derived name unchanged.

**Rationale**: The heading is the only place a human has written the capability's real name. The folder slug is a machine artifact, and turning it back into a display name loses information that cannot be recovered — "SpecKit" and "Speckit" are the same slug. Reading the heading is cheap because the document text is already in hand at the moment the header is built.

**Alternatives considered**: Storing a display name in the capability's configuration entry. Rejected — it would require every adopted capability to be re-registered, it duplicates a name that already exists in the document, and the two copies would drift.

## Decision — The suffix strip is a pattern, not a literal

**Decision**: Strip a trailing separator-plus-"Living Spec" from the heading, tolerating an em dash, an en dash or a hyphen, any surrounding whitespace, and any casing.

**Rationale**: The adoption command writes an em dash, but a human editing the file afterwards may not. Matching only the exact literal would leave a visible suffix on hand-edited specs, and a reader would read that as a bug.

**Alternatives considered**: Strip nothing and show the heading verbatim. Rejected — "SpecKit Extension Capture — Living Spec" as a page title next to a LIVING badge says "living spec" twice, which is the same complaint the ticket makes about DRAFT.

## Decision — Turn off the presentational capitalization for authored titles

**Decision**: The header title carries `text-transform: capitalize` because feature-spec names arrive as lowercase directory slugs. Add a modifier that switches it off when the title came from a document heading.

**Rationale**: Without this, reading the heading is pointless — the stylesheet would re-mangle "SpecKit Extension Capture" on the way to the screen. This is the second half of the same fix, and finding it late would have looked like the fix simply not working.

**Alternatives considered**: Remove `text-transform` entirely. Rejected — feature specs would then display raw slugs, a regression for the far more common case.

## Decision — Reuse the sidebar's coverage and drift, do not reimplement

**Decision**: The header's facts come from `readLivingSpecs` and `readCapabilityHealth` in `src/features/specs/livingSpecsModel.ts` — the exact functions the Living Specs tree uses.

**Rationale**: Two derivations of one fact that disagree is this repository's most persistent bug class, and it is named as such in the review checklist. Reuse makes disagreement structurally impossible rather than merely unlikely. The functions are already best-effort by design: every failure path yields an absent field, never a zero, which matches what the header needs.

**Alternatives considered**: Extracting a shared service that both the tree and the viewer call through. Rejected as premature — the model module already is that shared layer; adding another one on top would be indirection with no new behavior.

## Decision — Do not make the header wait on git

**Decision**: Build the header from the synchronous facts first — title, counts, claimed patterns, spec location — and render. Resolve the drift check afterwards and push the coverage and drift fields to the already-open panel as a navigation-state update.

**Rationale**: Drift requires two git commands. They are time-bounded at a second and a half, but a second and a half of blank panel on every open is a visible regression to pay for one small marker. Coverage rides along in the same follow-up because it is computed in the same call; it reads from the filesystem and would be fast on its own, but splitting the call to shave milliseconds is not worth a second code path.

**Alternatives considered**: Blocking on the whole health call before first paint. Rejected on the open-latency grounds above. Also considered a spinner in the header while health resolves — rejected as noise for a fact that is absent in many repositories anyway.

## Decision — Count requirements by the identifier convention already in use

**Decision**: Count distinct requirement identifiers of the form `FR-nnn` / `NFR-nnn` in the document, matching the same pattern the coverage check uses. Count acceptance scenarios by the numbered Given/When/Then form the adoption command writes.

**Rationale**: The coverage figure is already "how many of these identifiers have a mapped test", so counting the same identifiers guarantees the requirement count and the coverage denominator agree. A count derived some other way could show "12 requirements" beside "8/9 covered", which is worse than showing nothing.

**Alternatives considered**: Counting heading or list items under a Requirements section. Rejected — it is sensitive to document formatting and would disagree with the coverage denominator.

## Decision — Show a few claimed patterns inline, the rest on demand

**Decision**: Render the first three claimed file patterns as chips, and when there are more, a trailing "+N more" chip that carries the full list.

**Rationale**: The claimed-files list is the single most valuable fact in the ticket, but capabilities routinely claim a handful of patterns and some claim many. Three covers the common case fully and keeps the header one line; the overflow keeps the rest reachable without a layout that grows without bound.

**Alternatives considered**: Showing all patterns always. Rejected — a capability with a dozen patterns would push the document below the fold. Showing only a count ("claims 6 patterns"). Rejected — it fails the ticket's actual question, which is *which* files.
