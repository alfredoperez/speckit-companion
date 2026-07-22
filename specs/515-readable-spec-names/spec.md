# Feature Specification: Readable Spec Names Instead of the Dash-Separated Slug

**Feature Branch**: `515-readable-spec-names`
**Created**: 2026-07-21
**Status**: Draft
**Source**: [#502](https://github.com/alfredoperez/speckit-companion/issues/502)

## User Scenarios & Testing

### User Story 1 - Readable spec titles in the sidebar (Priority: P1)

A person scanning the Specs tree in the sidebar sees each spec labeled with a real title — "Readable Spec Names" — instead of the raw directory slug `515-readable-spec-names`. The tree reads like a list of features, not a list of branch names.

**Why this priority**: This is the whole point of the issue and the one place still showing the raw slug. It delivers the value on its own even if nothing else changes.

**Independent Test**: Open the Specs sidebar in a workspace with several specs. Every row shows a humanized, capitalized title with no leading number and no dashes. The change is visible without opening any spec.

**Acceptance Scenarios**:

1. **Given** a spec directory `515-readable-spec-names` whose `.spec-context.json` records `specName: "Readable Spec Names"`, **When** the Specs tree renders its row, **Then** the row label reads "Readable Spec Names".
2. **Given** a spec directory `406-living-spec-components` with no recorded `specName`, **When** the Specs tree renders its row, **Then** the row label reads "Living Spec Components" (leading number dropped, dashes replaced, title-cased).
3. **Given** two specs whose humanized names collide, **When** the tree renders them, **Then** each row still carries its existing disambiguating description (the parent directory) so the two remain distinguishable.

### User Story 2 - Consistent readable title in the viewer header (Priority: P2)

When a person opens a spec in the viewer, the header title matches the readable name they clicked in the sidebar. The sidebar and the header agree on what the spec is called.

**Why this priority**: The viewer header already humanizes the slug and reads a living spec's H1, so most of this is done. This story guards against the sidebar and header drifting apart once the sidebar changes.

**Independent Test**: Click a spec in the sidebar, then read the viewer header. The title shown in the header is the same readable name shown in the tree row.

**Acceptance Scenarios**:

1. **Given** a spec opened in the viewer, **When** the header renders, **Then** its title equals the readable name resolved by the same rule the sidebar uses (recorded name, else document heading, else humanized slug).
2. **Given** a living spec with an `# H1` heading, **When** it is opened, **Then** the header shows the H1 text, matching today's behavior.

### Edge Cases

- A spec with no `.spec-context.json` at all — the humanized slug is the fallback, so the row still shows a readable name.
- A recorded `specName` that is an empty string or whitespace — treated as absent, so the humanized slug is used rather than a blank label.
- A slug with no leading number (e.g. a hand-made `my-feature` dir) — humanize the whole slug; there is no number to drop.
- A slug that is only a number (e.g. `042`) — fall back to showing the slug unchanged rather than an empty label.
- The same spec resolved twice must produce the same readable name, so a person can reliably find it again.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST display a readable spec name for each spec row in the Specs sidebar tree instead of the raw directory slug.
- **FR-002**: The readable name MUST be resolved by preference order: (1) the spec's recorded name (`specName` in `.spec-context.json`), (2) the spec document's own heading where one exists (living specs), (3) a humanized version of the directory slug.
- **FR-003**: The humanized-slug fallback MUST drop the leading numeric prefix, replace dashes and underscores with spaces, and capitalize words (e.g. `515-readable-spec-names` → "Readable Spec Names").
- **FR-004**: The viewer header title MUST use the same resolution rule as the sidebar so the two always agree on a spec's readable name.
- **FR-005**: The change MUST be presentation only — the directory slug and the branch name MUST remain unchanged as the stable underlying identifier.
- **FR-006**: The resolution MUST be stable — the same spec MUST always resolve to the same readable name across refreshes and sessions.
- **FR-007**: A recorded name that is empty or whitespace-only MUST be treated as absent, falling through to the next preference.
- **FR-008**: Existing sidebar affordances that depend on the slug (fuzzy filter, sort, duplicate-name disambiguation description, open command) MUST keep working unchanged.

## Key Entities

- **Spec**: A feature under `specs/<NNN-slug>/`. Identified on disk by its slug (stable). Carries an optional `.spec-context.json` whose `specName` field is the recorded human name. Living specs additionally carry a document `# H1` heading.
- **Readable name**: The presentation-only display string resolved for a spec, derived from recorded name → document heading → humanized slug.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of spec rows in the sidebar display a name with no leading number and no dash separators.
- **SC-002**: For any spec with a recorded `specName`, the sidebar row and the viewer header show that exact recorded name (0 mismatches).
- **SC-003**: For any spec without a recorded name, both surfaces show the identical humanized-slug string (0 mismatches between sidebar and header).
- **SC-004**: Resolving the same spec's readable name twice yields an identical string in 100% of cases.
- **SC-005**: No directory or branch is renamed as a result of this feature (0 on-disk identifier changes).

## Assumptions

- The existing `deriveSpecName()` helper already implements the humanized-slug rule (drop leading number, replace dashes, title-case) and is the intended fallback; this feature reuses it rather than introducing a second humanizer.
- The viewer already prefers `specName` then a living-spec H1 then the humanized slug, so the primary new work is bringing the sidebar to the same rule; the viewer path is verified, not rebuilt.
- "Document heading" as a name source applies to living specs, which are the specs that carry a real `# H1`; ordinary spec.md files rely on the recorded name or the humanized slug.
- Duplicate-name disambiguation continues to key off the slug/parent directory, unchanged by switching the visible label to the readable name.

## Verbatim Constraints

- `specName` — the `.spec-context.json` field read as the first-choice recorded name.

## Approach

Presentation-only change centered on the sidebar; the viewer already resolves the readable name.

- Introduce (or reuse) a single shared resolver that returns a spec's readable name from a `specName` value plus its directory, applying the preference order: recorded name → living-spec heading → humanized slug via the existing `deriveSpecName()`. Treat empty/whitespace `specName` as absent. Keep it a pure function so both surfaces call the same logic.
  - Likely home: `src/core/utils/` (or alongside `deriveSpecName` in `src/features/specs/specContextManager.ts`), so the sidebar does not import from `spec-viewer/`.
- In `src/features/specs/specExplorerProvider.ts`, build each spec row's label from the resolver instead of the raw `spec.name`. The `.spec-context.json` is already read at the row-build site, so `specName` is in hand; no extra file read for the common case.
- In the viewer (`src/features/spec-viewer/specViewerProvider.ts`), route its existing `featureCtx?.specName ?? deriveSpecName(...)` header derivation through the same shared resolver so the two surfaces cannot drift.
- Keep the slug as the id everywhere it is used today (fuzzy filter, sort comparators, duplicate-name description, `speckit.openSpec` command argument). Only the visible label changes.
- Update `docs/sidebar.md` (the long-form sidebar reference) to note that rows show the readable name with the slug as the stable identifier.

**Dependencies**: none beyond the existing `deriveSpecName()` helper and the already-read spec context in the sidebar provider.
