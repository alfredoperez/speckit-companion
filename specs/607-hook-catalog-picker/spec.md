# Feature Specification: Attach a hook from a list, not from memory

**Feature**: [#646](https://github.com/alfredoperez/speckit-companion/issues/646)
**Created**: 2026-09-06
**Status**: Specifying

The Pipeline Builder can already draw every hook a project runs, including the ones installed extensions registered. What it cannot do is add one. Attaching work is a free-text field: pick a kind, then type the command yourself. To attach the automatic commit you have to already know it is spelled `speckit.git.commit`, and nothing in the panel tells you.

Every kind of hook already has a list of what could go in it somewhere in the panel's data. Nothing offers those lists at the moment of attaching.

## User Scenarios & Testing

### User Story 1 - Pick the thing instead of spelling it (Priority: P1)

Someone attaching work to a step chooses the kind first, and then chooses the thing from a list of what this project actually has. Each entry says in plain words what it does, so the choice does not require knowing a command name. Typing one by hand still works, for anything the list does not have.

**Why this priority**: This is the whole issue. Without it the panel can show a pipeline it cannot help you build.

**Independent Test**: Attach the automatic commit to a step without typing anything, and without knowing what it is called.

**Acceptance Scenarios**:

1. **Given** the kind is a command, **When** the second selector opens, **Then** it lists the commands this project has installed, each with a plain description.
2. **Given** the kind changes to a skill, **When** the second selector opens, **Then** it lists this project's skills instead, and whatever was chosen for the previous kind is not carried over.
3. **Given** an entry is chosen, **When** the form is submitted, **Then** the hook is attached with that entry's own identifier, exactly as typing it would have.
4. **Given** the wanted thing is not in the list, **When** it is typed by hand, **Then** it is accepted exactly as before.
5. **Given** the project has no skills, **When** the skill kind is chosen, **Then** the form says the list is empty rather than showing an empty control that looks broken.
6. **Given** an instruction is the kind, **When** the second selector would appear, **Then** it does not, because an instruction is prose nobody could list.

### User Story 2 - The list is what this project has (Priority: P1)

The offered commands come from the registries the project actually carries. A project without the git extension is not offered the git hooks. A project that installs another extension is offered its hooks without anything being added here.

**Why this priority**: A hard-coded list is worse than no list, because it lies about what is installed and the lie is only found when the pipeline runs.

**Independent Test**: Remove an extension from the project's registry; the picker stops offering its commands with no other change.

**Acceptance Scenarios**:

1. **Given** the project registry lists an extension's hooks, **When** the picker opens, **Then** those commands are offered with the descriptions the registry carries.
2. **Given** an extension is absent, **When** the picker opens, **Then** none of its commands appear.
3. **Given** a registry that cannot be read, **When** the picker opens, **Then** it offers what it can and the form still works.
4. **Given** the same command is registered for several steps, **When** the picker opens, **Then** it appears once.

### User Story 3 - Say where each one usually goes (Priority: P2)

An offered command carries where it normally attaches, so someone who does not know the pipeline can tell that the branch hook belongs before specify and the journaling hook belongs after implement.

**Why this priority**: It turns a list of names into a list of choices. Valuable, but the list is useful without it.

**Independent Test**: Open the picker and read an entry without knowing the pipeline; it says what the hook does and where it usually goes.

**Acceptance Scenarios**:

1. **Given** a command the registry places at a step, **When** it is offered, **Then** the entry says where it usually goes.
2. **Given** a command with no recorded placement, **When** it is offered, **Then** it is offered without one rather than with a guess.

## Edge Cases

- A registry entry with a name and no description.
- Two extensions registering the same command name.
- A command already attached at this exact anchor and side.
- Switching kind after choosing, then switching back.
- A project with no registry at all.
- A very long command name or description in a narrow panel.

## Requirements

### Functional Requirements

- **FR-001**: Attaching work MUST offer, for the chosen kind, a list of what this project has, without the user typing an identifier.
- **FR-002**: The second selector MUST react to the kind selector, offering only entries valid for that kind.
- **FR-003**: Changing the kind MUST clear a choice made for the previous kind rather than carrying it across.
- **FR-004**: Each offered entry MUST carry a plain-language description of what it does, where the source provides one.
- **FR-005**: Choosing an entry MUST attach the hook with that entry's exact identifier.
- **FR-006**: Typing an identifier by hand MUST remain possible for every kind that has one.
- **FR-007**: The offered commands MUST be derived from the registries the project carries, never from a list compiled into the panel.
- **FR-008**: A command registered for more than one step MUST be offered once.
- **FR-009**: An unreadable or absent registry MUST leave the form working, offering whatever else could be read.
- **FR-010**: A kind with nothing to offer MUST say so rather than present an empty control.
- **FR-011**: The instruction kind MUST NOT show a second selector, because its value is prose.
- **FR-012**: An offered command SHOULD say where it usually attaches, and MUST omit that rather than guess when the source does not say.
- **FR-013**: Everything the form does today MUST keep working: editing a hook in place, moving it to another boundary, and the note field.

## Key Entities

- **Offered entry** — one thing that can go in a hook of a given kind. Carries the identifier that gets written, a label, an optional description, and an optional usual placement.
- **Catalog** — every offered entry, grouped by kind, derived per project from what it has installed.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The automatic commit hook can be attached without typing any part of its name.
- **SC-002**: Every command the project's registries carry appears in the picker exactly once.
- **SC-003**: A project without a given extension is offered none of its commands.
- **SC-004**: Every existing test for attaching, editing and moving a hook passes unchanged.
- **SC-005**: Removing the project's registry leaves the form usable.

## Assumptions

- The catalog is built where the rest of the panel's data is built, and travels in the same message, because a second fetch would be a second source that drifts.
- The picker offers what is installed, not what could be installed. Discovering uninstalled extensions is a different feature.
- An entry's usual placement is informational. It does not move the hook or restrict where it can go, because a project may legitimately attach a hook anywhere.

## Verbatim Constraints

- The registry of installed spec-kit extensions is `.specify/extensions.yml`.
- Companion's own hooks are declared under `hooks:` in `speckit-extension/extension.yml`.
- The commands named in the issue as examples: `speckit.git.initialize`, `speckit.git.feature`, `speckit.git.commit`, `speckit.companion.after-specify`, `speckit.companion.after-plan`, `speckit.companion.after-tasks`, `speckit.companion.after-implement`.

## ADDED Requirements

<!-- capability: capture-runtime -->

### What a project could attach is emitted with the pipeline it draws
<!-- touches: speckit-extension/scripts/build-pipeline.py, speckit-extension/scripts/pipeline-graph.py -->

The structure a panel draws SHALL carry, beside it, every hook command the project's own registries hold — the spec-kit extensions it registered and Companion's own — each with the description its registry gave it, the extension that declared it, and the lifecycle step it attaches at. A list compiled in here instead would lie about what a project has installed, and the lie would surface only when the pipeline ran. It travels with the structure rather than answering a second request, for the same reason the structure itself is derived once: a second source disagrees with the first, and the disagreement reads as one of them being out of date. A command SHALL be carried once however many steps register it, and SHALL name a usual placement only when the registries place it at exactly one — a stock install registers the automatic commit at nine, and naming the first one read presents a single truth out of nine as the answer. Reading a registry SHALL never fail the emission: one that cannot be read contributes nothing.

#### Scenario: an extension is installed
- **WHEN** the structure is emitted
- **THEN** that extension's hook commands are carried, in its own words, and a project without it is offered none of them

#### Scenario: a command is registered at several lifecycle steps
- **WHEN** the structure is emitted
- **THEN** it is carried once and names no usual placement, rather than naming whichever step was read first

#### Scenario: the registry cannot be read
- **WHEN** the structure is emitted
- **THEN** it carries what it could read and the panel still works
