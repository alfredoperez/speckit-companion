# Feature Specification: Spec Explorer Sidebar View

**Feature Branch**: `381-spec-explorer`
**Created**: 2026-06-26
**Status**: Draft
**Input**: Issue #380 — feat(living-specs): spec explorer in the sidebar

## Overview

Living specs — the long-lived capability documents that describe how a part of the codebase behaves — currently have no project-wide home in the sidebar. A developer can only see a living spec inside the per-feature spec viewer when a feature happens to load one. This feature adds a dedicated **Spec Explorer** view in the SpecKit activity-bar container that lists every living spec in the project and lets the developer open any of them with a click. The view only appears when the companion spec-kit extension is installed, so projects that never use living specs never see it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse and open living specs (Priority: P1)

A developer working in a project that uses living specs opens the SpecKit sidebar and finds a Spec Explorer view listing every capability the project defines. Each capability shows its name and where its spec lives (centralized in a capabilities folder, or colocated next to the code). Clicking a capability opens its spec document so the developer can read it.

**Why this priority**: This is the core value — a project-wide, clickable index of living specs. Without it the feature delivers nothing.

**Independent Test**: In a project whose companion config enables living specs with at least one capability, open the SpecKit sidebar, confirm the Spec Explorer lists each capability with its name and storage location, and confirm clicking one opens its spec file.

**Acceptance Scenarios**:

1. **Given** a project with living specs enabled and two capabilities defined, **When** the developer opens the Spec Explorer, **Then** both capabilities appear, each labelled with its name and its storage location (centralized or colocated).
2. **Given** the Spec Explorer is showing a capability, **When** the developer clicks the capability's spec entry, **Then** that capability's spec file opens in the editor.
3. **Given** a capability whose spec file does not yet exist on disk, **When** the developer views it in the explorer, **Then** the capability still appears but is visibly marked as not-yet-created and is not a broken click.

### User Story 2 - See a capability's tiers (Priority: P2)

A developer expands a capability in the Spec Explorer to see the layered documents that capability owns: the spec itself, plus an architecture document and a coverage document when those exist. Only the tiers that actually exist on disk are shown, so the tree never offers a dead click.

**Why this priority**: Tiers add depth once the basic index exists; valuable but not required for the first usable slice.

**Independent Test**: For a capability that has an architecture and/or coverage sibling file on disk, expand it in the explorer and confirm a child entry appears for each existing tier and none appear for missing ones; clicking a tier opens that file.

**Acceptance Scenarios**:

1. **Given** a capability whose spec has an architecture sibling and a coverage sibling on disk, **When** the developer expands the capability, **Then** a child entry appears for the spec, the architecture, and the coverage tiers.
2. **Given** a capability whose spec has no architecture or coverage sibling, **When** the developer expands the capability, **Then** only the spec tier is offered (no empty architecture/coverage entries).
3. **Given** a tier entry, **When** the developer clicks it, **Then** that tier's file opens in the editor.

### User Story 3 - Find orphan specs (Priority: P2)

A developer sees an Orphans group listing spec files in the project that no capability claims, so stray living specs are not invisible. Clicking an orphan opens it.

**Why this priority**: Orphan discovery prevents silent drift but is secondary to the main capability index.

**Independent Test**: Place a `*.spec.md` file outside any configured capability's area (and outside the feature `specs/` folder), open the explorer, and confirm it appears under an Orphans group and opens when clicked.

**Acceptance Scenarios**:

1. **Given** a `*.spec.md` file that no capability claims and that lives outside the feature `specs/` folder, **When** the developer opens the explorer, **Then** the file appears under an Orphans group.
2. **Given** a `*.spec.md` file that is a capability's claimed spec, a reserved tier sibling, or lives inside a configured capability's folder, **When** the developer opens the explorer, **Then** it does NOT appear as an orphan.
3. **Given** an orphan entry, **When** the developer clicks it, **Then** that file opens in the editor.

### User Story 4 - Friendly empty and hidden states (Priority: P1)

When living specs are turned off or no specs exist, the developer sees a calm, friendly message rather than an error or a broken tree. When the companion spec-kit extension is not installed at all, the view does not appear in the sidebar.

**Why this priority**: A view that errors or shows noise when there is nothing to show would undermine trust; the gated visibility is the issue's explicit requirement.

**Independent Test**: With living specs disabled, open the explorer and confirm a friendly empty message (no error). Remove the companion extension dir and confirm the view disappears entirely; restore it and confirm the view returns.

**Acceptance Scenarios**:

1. **Given** living specs are disabled (or there are no capabilities and no orphans), **When** the developer opens the explorer, **Then** a friendly empty-state message is shown and no error surfaces.
2. **Given** the companion spec-kit extension is not installed, **When** the developer views the SpecKit sidebar, **Then** the Spec Explorer view is not present.
3. **Given** the companion config changes while the sidebar is open, **When** the change lands on disk, **Then** the view's contents update without requiring a window reload.

## Edge Cases

- The companion config file is missing, empty, or malformed — the view shows the friendly empty state, never an error.
- A capability is declared as colocated but has no resolvable spec path — it is skipped gracefully rather than crashing the tree.
- A capability's spec file is deleted while the view is open — the next refresh reflects the change.
- Two capabilities resolve to the same spec path — the spec is listed once, not duplicated.
- A glob `*` in an orphan/exclusion rule must not cross a path separator (a single-segment wildcard stays within one segment).
- Feature specs under the `specs/` folder are never treated as living specs or orphans.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST contribute a new tree view in the SpecKit activity-bar container that lists the project's living specs.
- **FR-002**: The view MUST be visible only when the companion spec-kit extension is installed, and hidden otherwise, using the existing installed-state signal — no new detection logic.
- **FR-003**: The view MUST also respect the same workspace-non-empty guard the other SpecKit views use (hidden when no folder/workspace is open).
- **FR-004**: The view MUST group living specs into a Capabilities section (one node per capability) and an Orphans section.
- **FR-005**: Each capability node MUST be labelled with the capability name and its storage location (centralized or colocated).
- **FR-006**: Each capability node MUST expand to its tiers: the spec, plus an architecture tier and a coverage tier, showing a tier only when its file exists on disk.
- **FR-007**: Clicking a capability spec, a tier, or an orphan node MUST open the corresponding file in the editor.
- **FR-008**: A capability whose spec file does not exist MUST still be listed but visibly marked as not-yet-created, without a broken click.
- **FR-009**: The Orphans section MUST list `*.spec.md` files that no capability claims, excluding the feature `specs/` folder, reserved tier siblings, claimed spec paths, and files inside a configured capability's folder.
- **FR-010**: When living specs are disabled or there are no capabilities and no orphans, the view MUST show a friendly empty state rather than an error.
- **FR-011**: The system MUST read the living-specs configuration node-side (in the extension's own code), without requiring an external scripting runtime to render the view.
- **FR-012**: The view MUST refresh its contents when the companion config file or the capabilities tree changes on disk, and reflect the installed-state signal changing.
- **FR-013**: Capability spec path resolution MUST default to the centralized `capabilities/<name>/spec.md` location and honor an explicit colocated spec path when configured.

## Key Entities

- **Capability**: A named living-spec owner. Attributes: name, match/exclude globs (membership rules), resolved spec path, storage location (centralized or colocated), spec existence, and its tier siblings.
- **Tier**: A layered document belonging to a capability — the spec (hot), plus architecture and coverage siblings. Attributes: kind, file path, on-disk existence.
- **Orphan**: A `*.spec.md` file claimed by no capability. Attributes: file path.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In a project with N capabilities defined and living specs enabled, the explorer lists exactly N capability nodes plus every unclaimed orphan spec, with zero false orphans.
- **SC-002**: Every tier child shown in the tree corresponds to a file that exists on disk (100% — no dead tier entries).
- **SC-003**: Clicking any capability, tier, or orphan node with an existing file opens that exact file 100% of the time.
- **SC-004**: With the companion extension absent, the view never appears; with it present and living specs disabled, the view shows a friendly empty state and never surfaces an error.
- **SC-005**: After the companion config or capabilities tree changes on disk, the view reflects the change without a window reload.

## Assumptions

- The living-specs configuration lives in the `livingSpecs` block of the project's companion config file, with `enabled` and a list of capabilities each carrying name, match/exclude rules, and an optional explicit spec path — matching the existing resolver's contract.
- Reserved tier siblings use the architecture and coverage suffixes already defined by the resolver; the view does not invent new tier kinds.
- Opening a node opens the underlying file in the editor (the natural fit for a flat index), rather than routing through the rich spec viewer.
- The installed-state signal already maintained by the extension (an on-disk presence check mirrored into a context key) is the single source of truth for visibility; this feature adds no parallel detection.
