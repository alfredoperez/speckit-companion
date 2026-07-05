# Feature Specification: Spec Viewer renders the living specs a feature touches, readably

**Feature**: 392-living-specs-viewer
**Source**: [#394](https://github.com/alfredoperez/speckit-companion/issues/394)

## Overview

When a feature loads or folds back into living specs, the Activity panel today shows only their names — a list of capability chips with a "folded back" tag. To see what those capabilities actually require, or what the fold-back changed, you have to leave the viewer and open raw files. This change makes the panel render each touched capability's content readably: its purpose line, its requirements as titled rows, and the fold-back outcome — in the panel's established design language, not a raw markdown dump. Verification is fixtures-only by explicit decision: Storybook payloads plus a committed demo-spec fixture; this repository's own workspace does not enable living specs.

## User Scenarios & Testing

### User Story 1 - Read the capability without leaving the viewer (Priority: P1)

A reviewer opens a spec that loaded living specs. The Notes tab's Living Specs section now shows each capability with its one-line purpose and its requirements as readable titled rows (id chip + requirement text), open by default, in load order (most-specific first).

**Why this priority**: It's the issue's core ask — the names alone answer nothing.

**Independent Test**: Render the card with a fixture payload carrying two capabilities with requirements and confirm both render with purpose + requirement rows, no raw markdown syntax visible.

**Acceptance Scenarios**:
1. **Given** a spec whose context lists loaded capabilities and the workspace has their spec files, **When** the panel renders, **Then** each capability shows its name, purpose line, and requirement rows (id + text).
2. **Given** a capability's spec file contains markdown emphasis or headings in requirement text, **Then** the card renders clean text — no `#`, `**`, or backtick noise.
3. **Given** capabilities were loaded most-specific first, **Then** they render in that order.

### User Story 2 - See the fold-back result (Priority: P1)

For a completed spec that folded its deltas into a capability, the card shows the fold-back outcome on that capability: a folded-back tag as today, plus the delta summary when the feature spec carried delta blocks (added/modified/removed requirement counts).

**Why this priority**: The fold-back is living specs' whole point; its result must be visible where the run is reviewed.

**Independent Test**: Fixture with one synced capability + a feature spec carrying an ADDED-requirements block; the card shows the folded-back tag and "1 added".

**Acceptance Scenarios**:
1. **Given** a capability in the synced list, **Then** its section carries the folded-back tag (existing behavior preserved).
2. **Given** the feature's spec.md contains delta blocks for that capability, **Then** the card summarizes them (counts per kind); **Given** no delta blocks (the common additive case), **Then** no delta summary renders — never a fabricated "0 changes".

### User Story 3 - Degrade exactly like the rest of the panel (Priority: P2)

Old specs, missing files, and misconfigured workspaces never break the card: names-only data still renders the current chip list; an unresolvable or unreadable capability spec renders its name with a quiet "content unavailable" note; no living-specs data hides the card entirely.

**Why this priority**: The panel's contract is absent-when-empty and never-broken; new content must not regress it.

**Independent Test**: Render fixtures for names-only, missing-file, and empty payloads.

**Acceptance Scenarios**:
1. **Given** livingSpecs lists names but the workspace has no matching spec files, **Then** each name renders with the unavailable note — no error, no empty chrome.
2. **Given** no livingSpecs data, **Then** the card is absent (unchanged).
3. **Given** a capability spec larger than the read cap, **Then** the card renders the capped content without hanging the viewer.

## Edge Cases

- Capability listed in synced but not loaded → still rendered (fold-back without a recorded load).
- Duplicate names across loaded and synced → de-duplicated, synced tag wins.
- Requirement text with attribute-breaking characters (quotes, angle brackets) → rendered as text nodes only, never through markup interpolation.
- Colocated capabilities (spec path from config, not `capabilities/<name>/`) → resolved through the same rules the Spec Explorer model uses.
- Workspace config absent or malformed → treat as names-only (no content), never throw.
- A very long requirements list → the per-capability disclosure keeps the tab scannable; content stays open by default per the panel's disclosure convention.

## Requirements

### Functional Requirements

- **FR-001**: The viewer state MUST carry structured content for each touched capability — name, purpose line, requirement rows (id + text) — resolved and parsed on the extension side from the workspace's capability spec files.
- **FR-002**: Capability resolution MUST reuse the Spec Explorer's existing config-reading rules (centralized and colocated paths) rather than a second resolver.
- **FR-003**: The Living Specs section MUST render each capability as an open disclosure with purpose and requirement rows in the panel's design language; requirement text renders as plain text (markdown markers stripped), never raw markup.
- **FR-004**: The synced/fold-back state MUST remain visible per capability, extended with a delta summary (counts per ADDED/MODIFIED/REMOVED/RENAMED kind) when the feature spec carries delta blocks for it; absent otherwise.
- **FR-005**: Content loading MUST be best-effort and non-blocking: missing/unreadable/oversized files degrade to name + "content unavailable" (with a size cap), and a names-only payload renders today's chip list.
- **FR-006**: All new strings MUST render as text nodes (injection safety) and all styling MUST be token-driven and theme-safe.
- **FR-007**: Stories MUST cover rich (content + deltas), sparse (names-only), and unavailable-content payloads; parsing and derivation logic MUST be unit-tested.
- **FR-008**: A committed demo fixture MUST let the card be exercised in the real viewer without enabling living specs in this repository's own config.
- **FR-009**: The README Activity section and the root changelog MUST be updated in the same change.

## Key Entities

- **Capability content (viewer)**: name, purpose (one line), requirements[] (id, text), available flag, syncedDelta? (counts per kind).
- **Delta summary**: per-capability counts parsed from the feature spec's delta blocks; present only when blocks exist.

## Success Criteria

### Measurable Outcomes

- **SC-001**: With the rich fixture, a reviewer can read every requirement of both capabilities and the fold-back counts without leaving the panel; zero raw markdown markers visible.
- **SC-002**: The sparse and unavailable fixtures render without errors or empty chrome; the no-data case stays absent.
- **SC-003**: All jest suites and both tsc configs pass; new parsing/derivation logic has unit tests.
- **SC-004**: This repository's `.specify/companion.yml` and directory tree are unchanged (no livingSpecs enablement, no capabilities/ dir).

## Assumptions

- The capability spec's "requirements" are its `## Requirements`-style titled entries as authored by the living-specs adopt/fold flow; scenarios render only via requirement text (a full scenario tree is out of scope for this pass).
- Content is loaded when the viewer state is built (same lifecycle as the rest of the panel data); no file watcher on capability specs in this pass.
- The read cap and parse rules live extension-side; the webview receives only structured, pre-parsed data.

## Verbatim Constraints

- Component: `webview/src/spec-viewer/components/cards/LivingSpecsCard.tsx`.
- Data source fields: `livingSpecs.loaded` / `livingSpecs.synced` on `.spec-context.json`.
- Do NOT enable living specs in this repo's `.specify/companion.yml`; do NOT create `capabilities/` here.
