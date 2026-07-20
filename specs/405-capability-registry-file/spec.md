# Feature Specification: Capability registrations get their own file

**Feature Branch**: `405-capability-registry-file`
**Created**: 2026-07-19
**Status**: Draft
**Input**: Fix issue #482 — adopting living-spec capabilities and then running the routine local-install cleanup silently deletes every registration.

## Overview

When someone adopts living specs for a codebase, each capability they register is written into a settings file that also holds install-managed configuration. That file lives in a folder the project's own routine cleanup step throws away and re-creates. So a person can spend an afternoon adopting fourteen areas of their codebase, run a normal install or merge cleanup, and lose all fourteen registrations without a single message telling them it happened. The spec files they wrote stay on disk, but nothing claims them any more, so living specs simply stop working.

This feature gives capability registrations a home of their own — a file that belongs to the person, not to the installer, and that no cleanup step sweeps. Anyone who already registered capabilities in the old place keeps them: their registrations are read from wherever they are, and moved to the new home the next time they register or relocate anything.

## User Scenarios & Testing

### User Story 1 - Registrations survive routine cleanup (Priority: P1)

Someone adopts a handful of capabilities for their codebase, then does the ordinary things a maintainer does during a day: installs the extension locally, merges a pull request, resets their working tree to match the remote. When they come back to their living specs, every capability they registered is still there and still resolving. Nothing they did as part of normal maintenance touched their registrations.

**Why this priority**: This is the entire bug. Without it, adoption is not durable and every other living-specs feature rests on sand.

**Independent Test**: Register a capability, run the exact cleanup command the project's workflows use, and confirm the capability is still registered and still resolves.

**Acceptance Scenarios**

1. **Given** a project with no capabilities registered, **When** a capability is registered, **Then** it is written to the project's capability registry file, which sits outside the folder the cleanup step restores.
2. **Given** a project with registered capabilities and no other pending edits, **When** the routine cleanup step is run, **Then** every capability is still registered afterward and the registry file is unchanged.
3. **Given** a project with registered capabilities, **When** the resolver is asked which capability owns a changed file, **Then** it answers from the new registry file exactly as it did before the move.
4. **Given** a registered capability, **When** the working tree is reset to match the remote after the registry file has been committed, **Then** the capability survives, because the registry is ordinary project configuration that gets committed alongside the code.

---

### User Story 2 - Existing registrations are never stranded (Priority: P1)

Someone who adopted capabilities before this change updates the extension. Their capabilities are in the old location. Nothing they do is interrupted: living specs keep resolving, the sidebar keeps listing their capabilities, drift and coverage keep reporting. The first time they register or relocate a capability, their whole set quietly moves to the new home, and a short note tells them it moved.

**Why this priority**: Shipping a new location without carrying the old one forward would cause the same silent loss this feature exists to prevent, just once, on upgrade.

**Independent Test**: Put capabilities only in the old location, confirm every reader still sees them, then register one more and confirm all of them now live in the new file and none remain in the old one.

**Acceptance Scenarios**

1. **Given** capabilities registered only in the old location, **When** any reader resolves capabilities, **Then** it reads them from the old location and behaves exactly as before.
2. **Given** capabilities registered only in the old location, **When** a new capability is registered, **Then** the new file holds the full set including the new one, and the old location's capability block is removed while everything else in that file is left untouched.
3. **Given** capabilities in both locations, **When** any reader resolves capabilities, **Then** the new file wins outright and the reader notes that a stale block remains in the old location.
4. **Given** capabilities registered only in the old location, **When** a capability is relocated between central and colocated placement, **Then** the relocation succeeds and the resulting registry is written to the new file.

---

### User Story 3 - The registry is obvious to find and edit by hand (Priority: P2)

Someone who wants to add a capability without running a command opens their project, sees a plainly named file at the top level, opens it, and finds a short list of capability names with the files each one owns. They add an entry by hand, and every part of the tool picks it up.

**Why this priority**: Hand-editing is the documented fallback for adoption, and a registry nobody can find is a registry nobody maintains.

**Independent Test**: Add a capability entry to the registry file by hand and confirm the resolver, the sidebar, drift, and coverage all see it.

**Acceptance Scenarios**

1. **Given** a project with living specs adopted, **When** someone lists the project's top-level files, **Then** the registry file is visible there under a name that says what it holds.
2. **Given** a hand-written registry file, **When** the resolver runs, **Then** it reports the hand-written capabilities with no complaint.
3. **Given** a registry file the tool cannot parse, **When** a registration is attempted, **Then** the tool refuses to write and says why, leaving the file exactly as the person left it.

---

### User Story 4 - A project that never adopted keeps behaving as before (Priority: P2)

A project that has never turned living specs on sees nothing new. No file appears, no warning is printed, and every command behaves exactly as it did.

**Why this priority**: Living specs are opt-in. A migration that makes non-adopters notice anything is a regression.

**Independent Test**: Run every living-specs reader against a project with neither the old nor the new location and confirm each reports nothing, quietly and successfully.

**Acceptance Scenarios**

1. **Given** a project with neither a registry file nor a capability block in the old location, **When** any living-specs reader runs, **Then** it reports no capabilities, exits successfully, and prints no warning.
2. **Given** such a project, **When** the sidebar's Living Specs view is opened, **Then** it shows the same "not adopted" state it shows today.

---

## Edge Cases

- The registry file exists but is empty, or holds an empty capability list. Treated as adopted-but-empty, not as an error.
- The registry file is present and turned off explicitly. The project must read as opted out, so a sandbox or sample app inside a larger repo can say "leave me alone" and be left alone.
- Both locations hold capabilities. One must win outright and the person must be told the other is stale, rather than the two being silently merged into a set that matches neither file.
- A sub-directory of the repository is itself a separate project. The boundary rule that stops the scan at nested projects must now recognize a nested project by either the new registry file or the old settings file, or a nested project that has already migrated would stop being a boundary and its specs would be re-reported as the parent's orphans.
- The registry file cannot be parsed. Writers must refuse rather than overwrite, so a typo never costs someone their registrations.
- A registration value contains characters the constrained writer cannot safely emit. It must be rejected before anything is written.

## Requirements

### Functional Requirements

- **FR-001**: Capability registrations MUST be stored in a dedicated registry file that is not inside the folder restored by the project's routine cleanup step.
- **FR-002**: The registry file MUST be ordinary project configuration that is committed to version control, so registrations are shared with everyone working on the project.
- **FR-003**: The registry file MUST sit at a top-level, self-describing path so someone can find and hand-edit it without reading the documentation.
- **FR-004**: The on/off switch for living specs MUST live in the registry file alongside the capabilities, so the decision to adopt and the registrations that express it cannot be separated.
- **FR-005**: Every reader of capability registrations MUST prefer the registry file when it exists, and fall back to the old location when only the old location has them.
- **FR-006**: When both locations hold capability registrations, readers MUST use the registry file only, and MUST surface a warning that a stale block remains in the old location.
- **FR-007**: Every writer of capability registrations MUST write to the registry file, and MUST move any registrations found only in the old location into it as part of that write.
- **FR-008**: When a writer moves registrations out of the old location, it MUST remove only the capability block from that file and leave every other setting, comment, and blank line in it untouched.
- **FR-009**: A writer MUST report, in plain language, when it has moved registrations from the old location to the registry file.
- **FR-010**: A project with neither location present MUST read as "living specs not adopted": every reader reports nothing, exits successfully, and prints no warning.
- **FR-011**: A writer MUST refuse to write, without truncating or overwriting, when the file it would write to cannot be parsed.
- **FR-012**: The rule that treats a nested sub-directory as a separate project MUST recognize such a project by either the registry file or the old settings file.
- **FR-013**: The change-watching that refreshes the Living Specs view MUST react to edits of the registry file.
- **FR-014**: All project documentation and command instructions that name the old location for capability registrations MUST name the registry file instead.
- **FR-015**: The project's own workflow documents that carry the cleanup step MUST state that capability registrations are no longer at risk from it, so the line does not need revisiting.

## Key Entities

- **Capability registry**: The project-level record of which capabilities exist. Holds the adoption switch, the drift exemption list, and one entry per capability. Owned by the person, committed with the project.
- **Capability entry**: One capability's name, the file patterns it owns, the patterns it excludes, and where its living spec lives.
- **Companion settings**: The install-adjacent configuration that keeps pipeline hooks and recipes. After this change it no longer holds capability registrations.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Registering a capability and then running the project's routine cleanup step leaves 100% of registrations intact, verified by running the real cleanup command in a test.
- **SC-002**: 100% of capabilities registered in the old location are readable without any action from the person, and are moved to the registry file on the first subsequent write.
- **SC-003**: A project with neither location produces zero warnings and zero non-zero exit codes across every living-specs reader.
- **SC-004**: Every place in the product that reads or writes capability registrations goes through one shared resolution of where the registry lives — no second, independent answer to "where is the registry".
- **SC-005**: Each new test fails when the change it guards is reverted, confirmed one test at a time.

## Assumptions

- The registry file is named for the feature it serves, so someone searching the documentation for "living specs" finds the file, and someone browsing the project's top level can guess what it holds.
- Reading falls back to the old location rather than migrating on read. Reading is expected to be side-effect free, may happen with no write permission, and should not produce surprise changes in someone's working tree. Migration therefore happens on the next write, when the person is already deliberately changing their configuration.
- The old location keeps its pipeline hook and recipe settings. Only the capability registrations move.
- The drift exemption list travels with the capabilities, because it only means anything in the presence of capabilities.

## Verbatim Constraints

- The cleanup step this feature must survive: `git restore package.json package-lock.json .specify/`
- The old location: `.specify/companion.yml`
