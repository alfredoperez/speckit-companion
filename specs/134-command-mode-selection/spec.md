# Feature Specification: Command Mode Selection

**Feature Branch**: `134-command-mode-selection`
**Created**: 2026-06-09
**Status**: Draft
**Input**: GitHub issue [#223](https://github.com/alfredoperez/speckit-companion/issues/223) — "Mode selection: keep standard + lean commands both present, route via a Companion option (no preset swap)"

## User Scenarios & Testing *(mandatory)*

SpecKit Companion offers two pipeline shapes — **standard** and **lean**. Today the choice between them is implemented by swapping two mutually-exclusive command bundles: picking one removes the other. Removing the standard bundle deletes the stock commands the host AI relies on, and the replacement add is a no-op, so the project can be left with no usable commands. The result is an "Unknown command" error and an inability to create specs. This feature reframes the choice as a non-destructive selection where both shapes are always present and only the dispatched shape changes.

### User Story 1 - Creating a spec never fails with "Unknown command" (Priority: P1)

A developer uses SpecKit Companion to create a new spec. No matter which mode is active, and no matter how many times they have switched modes, the create action always dispatches a command that exists — they never see "Unknown command: /speckit-specify", and the spec is created.

**Why this priority**: This is the headline regression the feature exists to fix. If creating a spec can fail, the product is unusable in that mode. Delivered alone, it restores the core promise — you can always start a spec.

**Independent Test**: With the previously-broken lean mode active, create a spec on each supported provider and confirm it succeeds with no "Unknown command" error.

**Acceptance Scenarios**:

1. **Given** lean mode is active, **When** the developer creates a spec, **Then** the spec is created and no "Unknown command" error appears.
2. **Given** the developer has switched modes several times, **When** they create a spec, **Then** the command resolves and the spec is created.
3. **Given** any supported AI provider, **When** a spec is created, **Then** the dispatched command exists for that provider.

---

### User Story 2 - Switching modes never deletes either command set (Priority: P2)

A developer chooses between the standard and lean pipeline shapes. Switching the mode is non-destructive: the other mode's commands are never deleted, removed, or overwritten. Both shapes remain installed and available at all times.

**Why this priority**: Mode switching is the everyday interaction, and its safety is what makes the P1 guarantee hold over time. Without it, a single switch could still strand the project with no commands.

**Independent Test**: Toggle the mode from standard to lean and back; after each switch, confirm both the standard and lean command sets are still present.

**Acceptance Scenarios**:

1. **Given** standard mode, **When** the developer switches to lean, **Then** the standard commands remain present.
2. **Given** lean mode, **When** the developer switches to standard, **Then** the lean commands remain present.
3. **Given** either switch, **When** it completes, **Then** no command emissions have been removed.

---

### User Story 3 - Mode is chosen through one Companion option that maps to the right shape (Priority: P2)

The developer selects the pipeline shape through a single SpecKit Companion option. Selecting lean produces the lean shape for the spec; selecting standard produces the standard shape. The old right-click "Template Profile → Standard / Lean" menu is gone — the option is the only place the choice is made.

**Why this priority**: A single, predictable selection surface that reliably maps the chosen mode to the produced shape is the usable form of the fix. It depends on P1/P2 being in place but completes the intended experience.

**Independent Test**: Set the option to lean, create/run a spec, and confirm the lean shape is produced; set it to standard and confirm the standard shape; confirm the old right-click menu no longer appears.

**Acceptance Scenarios**:

1. **Given** the Companion option is set to lean, **When** a spec runs, **Then** the lean shape is produced.
2. **Given** the Companion option is set to standard, **When** a spec runs, **Then** the standard shape is produced.
3. **Given** the new option exists, **When** the developer right-clicks a spec, **Then** the old "Template Profile → Standard / Lean" menu item is not offered.

---

### User Story 4 - Both command sets survive reload and a fresh checkout (Priority: P3)

After reloading the editor or checking out the repository fresh, both command sets are still present and usable without any manual repair step.

**Why this priority**: Durability across the two most common "lose my state" events is what makes the guarantee trustworthy day to day, but it is a refinement on top of the in-session guarantees above.

**Independent Test**: Reload the editor, then check out the repo fresh in a clean clone; in each case confirm both command sets are present and a spec can be created.

**Acceptance Scenarios**:

1. **Given** both command sets are present, **When** the editor reloads, **Then** both sets are still present.
2. **Given** a fresh checkout of the repository, **When** the workspace opens, **Then** both command sets are present.

---

### Edge Cases

- When the mode option is not surfaced (e.g., the beta-gated / install-gated picker is unavailable), the system defaults to the standard shape, whose commands are always present.
- A project whose stock commands were already deleted by a prior swap (before this fix) should recover to a state where both sets are present.
- Switching the mode while a spec is already in flight must not strand or corrupt that spec.
- Specs created under the old swap-based mechanism must continue to work after the change.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Both the standard and the lean command sets MUST be present simultaneously at all times.
- **FR-002**: Switching the command mode MUST NOT delete, remove, or overwrite either command set.
- **FR-003**: The command mode MUST be chosen through a single SpecKit Companion option, not by adding, removing, or swapping command bundles.
- **FR-004**: Selecting lean MUST produce the lean pipeline shape for the spec; selecting standard MUST produce the standard shape.
- **FR-005**: Creating a spec MUST NOT produce an "Unknown command" error on any supported AI provider.
- **FR-006**: Both command sets MUST persist across an editor reload and a fresh checkout of the repository without a manual repair step.
- **FR-007**: The old right-click "Template Profile → Standard / Lean" menu MUST be retired; the Companion option is the only mode-selection surface.
- **FR-008**: When the mode option is unavailable, the system MUST default to the standard shape (whose commands are always present).
- **FR-009**: A project left without its standard commands by a prior swap MUST be able to recover to a state where both command sets are present.

### Key Entities *(include if feature involves data)*

- **Pipeline shape (mode)**: One of two command shapes a spec can run — *standard* or *lean*. Both shapes are always installed; the mode only selects which one a spec uses.
- **Mode option**: The single SpecKit Companion control that records the developer's standard-vs-lean choice and drives which shape a spec runs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero "Unknown command" errors when creating specs, across every supported provider and both modes (today this fails in lean mode).
- **SC-002**: After any number of mode switches, 100% of both command sets remain present.
- **SC-003**: The mode is changed through exactly one surface (the Companion option); the old right-click menu is absent in 100% of cases.
- **SC-004**: Both command sets are present after an editor reload and after a fresh checkout, 100% of the time, with no manual repair.
- **SC-005**: Selecting lean yields the lean shape and selecting standard yields the standard shape in 100% of spec runs.

## Assumptions

- The mode is selected per spec, matching the granularity of the retired per-spec control, with a project-level default; this is inferred from the issue's framing ("which shape a spec uses", "selecting lean for a spec").
- The "Companion option" is the beta-gated, install-gated picker described in the related work (#218); when it is not surfaced, the standard shape is the default.
- "Supported providers" means the set listed in the README "Supported AI Providers" matrix.
- Existing specs continue to work because both command sets are now always present; no migration of in-flight specs is required.
- "Both command sets present" is the observable proxy for "no destructive swap"; the underlying delivery mechanism for each shape is left to planning.
