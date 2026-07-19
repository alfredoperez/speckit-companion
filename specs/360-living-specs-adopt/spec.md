# Feature Specification: Brownfield Adoption Wizard (Living Specs LS·5)

**Feature Branch**: `360-living-specs-adopt`
**Issue**: #365
**Status**: Specified

## Overview

Teams with an existing codebase want the benefits of living specs — a durable, plain-language record of how a capability behaves — without stopping to hand-write one spec per area. The brownfield adoption wizard lets a developer point at **one** code area and have the assistant propose a small tree of capabilities for just that area, draft a living spec for each from what the code already exposes, and register the confirmed capability so the rest of the Living Specs pipeline starts recognizing it.

Adoption is incremental and opt-in. It never scans or rewrites the whole repository, it never changes how any existing command behaves, and the developer explicitly runs it for the area they care about. Because the drafts are read surface-first (exports, routes, props, signatures — not a deep behavioral read), every drafted spec is clearly marked as a starting point: the whole spec carries a `[DRAFT]` banner, each requirement is tagged as either directly observed or inferred, low-confidence items are flagged inline, and anything the assistant could not read is listed honestly so the developer knows the draft's blind spots.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Adopt one code area into a living spec (Priority: P1)

A developer points the wizard at a single code area (for example, the billing module). The assistant reads the surface of that area, proposes one or a few capabilities scoped to just that area, and drafts a living spec for each into `capabilities/<name>/spec.md`. Each draft is well-formed (a title plus a `## Requirements` section), marked `[DRAFT]`, with requirements tagged observed vs inferred and a `## Uncovered` section listing files it could not read. The developer reviews and confirms, and the capability is registered.

**Why this priority**: This is the whole feature — pointing at an area and getting a registered, drafted living spec back is the value proposition. Everything else supports it.

**Independent Test**: Run the wizard against a fixture area with a couple of source files; confirm a `capabilities/<name>/spec.md` is created with the required structure and the capability appears in `.specify/companion.yml`.

**Acceptance Scenarios**:

1. **Given** a project with living specs enabled and a code area with readable source files, **When** the developer runs the adoption wizard against that area and confirms the proposal, **Then** a well-formed `capabilities/<name>/spec.md` is created (title + `## Requirements`) marked `[DRAFT]`, and the capability is appended to `livingSpecs.capabilities[]` in `.specify/companion.yml`.
2. **Given** a drafted living spec, **When** the developer reads it, **Then** each functional requirement carries an `observed` or `inferred` tag, low-confidence requirements carry an inline `[NEEDS CLARIFICATION: …]` marker, and any unreadable or over-budget files appear under a `## Uncovered` heading.
3. **Given** the capability has just been registered, **When** the resolver is asked which capability owns a file in that area, **Then** it returns the newly registered capability (the registry append is recognized by the shipped resolver immediately).

### User Story 2 - Adopt incrementally without disturbing existing config (Priority: P2)

A developer who has already adopted one area later adopts a second area. The new capability is appended to the registry; the existing capabilities, comments, and unrelated configuration in `.specify/companion.yml` are preserved untouched. Re-running adoption for an area that is already registered does not duplicate it or corrupt the file.

**Why this priority**: Incremental adoption is the core promise that separates this from a whole-repo bootstrap. It must be safe to run repeatedly and on top of prior runs.

**Independent Test**: Register a capability into a config that already has one capability; confirm both are present and the file is otherwise unchanged. Run the append again with the same name; confirm no duplicate is added.

**Acceptance Scenarios**:

1. **Given** a `.specify/companion.yml` that already registers one capability, **When** the developer adopts a second area, **Then** the new capability is appended and the prior capability and any other configuration remain intact.
2. **Given** a capability named `billing` is already registered, **When** the developer re-runs adoption for `billing`, **Then** the registry is left unchanged (idempotent — no duplicate entry).
3. **Given** living specs is disabled (or no config exists), **When** adoption registers a capability, **Then** the registry is created/updated with the capability under `livingSpecs.capabilities[]` and adoption does not flip any unrelated setting on.

### User Story 3 - Trust the draft's honesty (Priority: P3)

A reviewer reading a freshly drafted living spec can immediately tell what is solid and what is a guess. Observed requirements trace to something concrete in the code surface; inferred requirements are clearly speculative; clarification markers point at the genuinely ambiguous; and the `## Uncovered` section names exactly what the assistant did not get to read, so nobody mistakes a surface draft for a verified behavioral spec.

**Why this priority**: The draft is a live AI step, so honesty about its limits is what makes it safe to use. Without the tags and the Uncovered section, a draft could be mistaken for ground truth.

**Independent Test**: Inspect a drafted spec's structure and confirm the `[DRAFT]` banner, the observed/inferred tags, the clarification markers, and the `## Uncovered` section are all present and well-formed.

**Acceptance Scenarios**:

1. **Given** a drafted spec, **When** it is parsed, **Then** the first content line marks the whole spec `[DRAFT]` and the spec has a title and a `## Requirements` section.
2. **Given** a requirement the assistant could derive directly from an export or route, **When** it appears in the draft, **Then** it is tagged `observed`; a requirement extrapolated beyond the surface is tagged `inferred`.

## Edge Cases

- **Unreadable or over-budget files**: a file the assistant cannot read (binary, too large, permission) is not silently skipped — it is listed under `## Uncovered` so the draft's coverage is honest.
- **Already-registered capability**: re-running adoption for the same name must not duplicate the entry or corrupt the file.
- **Malformed existing config**: the registry-append helper must not destroy a `.specify/companion.yml` it cannot fully parse; it degrades safely rather than truncating the file.
- **No match globs**: a capability registered without a usable match pattern would never resolve; the wizard derives a sensible match glob from the adopted area.
- **Living specs disabled**: adoption is the one path a user explicitly runs to start using living specs, so it may create the registry block, but it must not silently enable unrelated behavior.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST provide a new spec-kit extension command (`speckit.companion.adopt`) that the developer explicitly runs against a single named code area; it MUST NOT scan or rewrite the whole repository.
- **FR-002**: The command MUST propose a tree of capabilities scoped to only the adopted area, not the whole codebase.
- **FR-003**: For each proposed capability, the command MUST draft a living spec into `capabilities/<name>/spec.md` read **surface-first** from existing code (exports, routes, props, signatures), not a deep behavioral read.
- **FR-004**: Each drafted spec MUST be well-formed: a title line, a `## Purpose` section, then a `## Requirements` section containing named `### <requirement>` headings each carrying at least one `#### Scenario:` — the OpenSpec requirement-and-scenario shape mandated by [358](../358-living-specs-foldback/spec.md). It MUST NOT use numbered `FR-`/`R###` bullets, and MUST NOT use `###` for section groupings, because fold-back identifies a requirement by its exact `###` heading text. (Superseded the earlier reading of the #363 well-formed-creation rule, which is a *feature*-spec rule and pulled the `FR-NNN` format in by default — see #453.)
- **FR-005**: The command MUST mark the whole drafted spec `[DRAFT]`.
- **FR-006**: `observed` MUST be the document-level default, stated once in the draft banner; only exceptions are tagged inline as `inferred` (extrapolated beyond the surface). Per-requirement `observed` tags are prohibited — a tag on every line carries no signal (see #445).
- **FR-007**: The command MUST flag low-confidence requirements inline with a `[NEEDS CLARIFICATION: …]` marker.
- **FR-008**: The command MUST list every file it could not read (unreadable or over budget) under a `## Uncovered` section in the drafted spec.
- **FR-009**: The system MUST provide a deterministic registry-append helper (Python, in the extension's scripts) that appends a confirmed capability to `livingSpecs.capabilities[]` in `.specify/companion.yml` with name, match, and spec.
- **FR-010**: The registry-append helper MUST be incremental — it appends a single capability and MUST NOT perform a whole-repo bootstrap or rewrite unrelated capabilities or configuration.
- **FR-011**: The registry-append helper MUST be idempotent: appending a capability whose name is already registered MUST leave the registry unchanged (no duplicate entry).
- **FR-012**: The registry-append helper MUST reuse the existing config reader (`companion_config.py`) so it does not corrupt or diverge from the established `.specify/companion.yml` contract.
- **FR-013**: After a capability is appended, the shipped resolver (`resolve-spec-paths.py`) MUST recognize it — a changed file under the adopted area MUST resolve to the new capability.
- **FR-014**: The new command MUST be registered in the extension manifest (`extension.yml` `provides.commands`) so the installer ships it.
- **FR-015**: Adoption MUST be opt-in and MUST NOT change the behavior of any existing command; running it MUST NOT alter an existing spec's lifecycle or any other command's output.
- **FR-016**: The spec-kit extension's own README and CHANGELOG MUST be updated and its `extension.yml` version bumped; the root README/CHANGELOG/`package.json` MUST NOT be touched.

## Key Entities

- **Capability**: a named area of behavior with a `match` glob (which files belong to it), an optional `exclude`, and a `spec` path (`capabilities/<name>/spec.md` by default). Adopted capabilities are appended to `livingSpecs.capabilities[]`.
- **Drafted living spec**: a markdown document at `capabilities/<name>/spec.md` carrying a `[DRAFT]` banner, a title, a `## Requirements` section of observed/inferred-tagged requirements (some with `[NEEDS CLARIFICATION]` markers), and a `## Uncovered` section.
- **Registry** (`.specify/companion.yml` `livingSpecs` block): the opt-in capability list the resolver and the rest of the pipeline read.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Running adoption against a single area registers exactly one new capability per confirmed proposal and leaves every previously registered capability present (100% preservation).
- **SC-002**: Re-running adoption for an already-registered capability adds zero duplicate entries.
- **SC-003**: After adoption, a changed file under the adopted area resolves to the newly registered capability in 100% of cases (the resolver recognizes the append).
- **SC-004**: A drafted spec passes a structural check for all four required elements — `[DRAFT]` banner, title + `## Requirements`, observed/inferred tags, and a `## Uncovered` section — with zero missing elements.
- **SC-005**: Adoption changes no existing command's output: a capture/lifecycle eval run over unrelated specs stays green before and after adoption.

## Assumptions

- The live AI drafting (reading code surface and writing prose) runs at command time as runtime prose in the command body, in the same manner as the existing `specify`/`plan` commands. The deterministically-buildable and testable parts are the command structure, the registry-append helper, and the structure of a drafted spec given a seeded draft.
- A capability's default `match` glob is derived from the adopted area path (for example, adopting `src/billing/` yields `match: ["src/billing/**"]`).
- The default `spec` path for an adopted capability is the centralized `capabilities/<name>/spec.md`.

## Verbatim Constraints

- Command name: `speckit.companion.adopt`
- Registry block / field: `livingSpecs.capabilities[]` in `.specify/companion.yml`
- Drafted spec path: `capabilities/<name>/spec.md`
- Draft banner: `[DRAFT]`
- Requirement tags: `observed`, `inferred`
- Clarification marker: `[NEEDS CLARIFICATION: …]`
- Uncovered section heading: `## Uncovered`
