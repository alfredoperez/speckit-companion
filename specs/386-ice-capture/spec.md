# Feature Specification: Complete the ICE capture — context and requirements at specify

**Feature**: 386-ice-capture
**Source**: [#399](https://github.com/alfredoperez/speckit-companion/issues/399)

## Overview

The capture layer records a spec's intent and its expectations — the I and E of the ICE model — but not the **C**: what context the run worked from. And requirements gained readable titles only at tasks time, coupled to coverage emission. This feature records context at specify (living specs loaded, areas investigated, constraints honored) and moves requirement titles to the moment the requirements are written, so a spec is fully ICE-described and requirement-queryable from its first step.

## User Scenarios & Testing

### User Story 1 - Requirements exist as text from the first step (Priority: P1)

When specify writes the functional requirements, each one is recorded into the spec's context with its id and one-line text — before planning or tasks ever run. A reader or tool can list a spec's requirements without parsing spec.md.

**Why this priority**: This is the user's direct ask ("log the requirements"); everything downstream (coverage, the redesigned panel) renders richer when titles exist early.

**Independent Test**: Run specify alone; the context's coverage map carries every FR id with its title and nothing else.

**Acceptance Scenarios**:
1. **Given** a spec with N functional requirements, **When** specify completes, **Then** the context holds N coverage entries, each with a `title`.
2. **Given** tasks later maps tasks and implement maps tests, **When** those steps run, **Then** the titles persist untouched (non-destructive merge).
3. **Given** a re-run of the same emissions, **Then** nothing duplicates (idempotent).

### User Story 2 - Context is captured (ICE completed) (Priority: P1)

The spec's context records what the run worked *from*: the living specs loaded into context, the key files/areas investigated, and the constraints honored — completing Intent/Context/Expectations.

**Why this priority**: The C is the missing ICE leg from the research; resume/handoff needs "what did it know" as much as "what did it want".

**Independent Test**: Run specify; the context carries a `context[]` list naming the loaded living specs and investigated areas.

**Acceptance Scenarios**:
1. **Given** specify investigated areas and loaded living specs, **When** it completes, **Then** `context[]` lists them, de-duped, first-seen order.
2. **Given** the same entry recorded twice, **Then** it appears once.
3. **Given** no context worth recording, **Then** the field is absent — never an empty shell.

### User Story 3 - The viewer can read both (Priority: P2)

The viewer's derived state exposes `context[]` (and continues exposing titled coverage), so the redesigned Activity panel can render the full ICE triad and a requirements list.

**Why this priority**: Read-side plumbing for the follow-up redesign; no UI work here.

**Independent Test**: Derive viewer state from a context carrying `context[]`; the field passes through typed and normalized.

**Acceptance Scenarios**:
1. **Given** a context with `context[]`, **When** state derives, **Then** `ViewerState.context` is the string list.
2. **Given** malformed entries (non-strings), **Then** they are dropped, never crash.

## Edge Cases

- Specs with NFR ids as well as FR ids → both get titled entries.
- A requirement edited later in spec.md → the title upsert on a later emission replaces it (last write wins per slot).
- `python3` unavailable → capture skipped silently, command never fails.
- Older readers → additive fields tolerated (`additionalProperties: true`).

## Requirements

### Functional Requirements

- **FR-001**: The capture writer MUST accept a `--context` flag recording de-duped, order-preserving string entries into `context[]`.
- **FR-002**: The specify command body MUST emit one titled coverage entry per functional requirement at specify completion.
- **FR-003**: The specify command body MUST emit `context[]` entries covering: living specs loaded (when any), key files/areas investigated, and constraints honored.
- **FR-004**: `context[]` MUST be declared in the schema and both ViewerState type copies, and pass through state derivation with non-string entries dropped.
- **FR-005**: All additions MUST be additive, idempotent, and best-effort (a capture miss never fails the host command).
- **FR-006**: The capture and schema docs MUST describe both changes in the same change.

### Key Entities

- **Context entry**: one string naming something the run worked from (a loaded living spec, an investigated area, a constraint).
- **Requirement title**: the existing coverage `title` slot, now written at specify time.

## Success Criteria

### Measurable Outcomes

- **SC-001**: After specify alone, 100% of the spec's FRs exist as titled coverage entries (this run's own context is the proof).
- **SC-002**: This run's context carries a non-empty `context[]` — the first spec with the full ICE triad.
- **SC-003**: All suites green; re-running the emissions changes nothing.

## Assumptions

- Context entries are strings, not structured objects — resume/handoff needs a readable list, not a taxonomy; structure can come later if a consumer demands it.
- Requirement titles ride the coverage map (one traceability home) rather than a parallel `requirements[]` list.
- The Activity panel rendering of these fields is the follow-up redesign (#400), not this change.
