# Companion steps read spec-kit's template stack

**Source**: issue #927, item w4 (slice 2 of 2)

## User Scenarios & Testing

### User Story 1 - A team's template override shapes Companion's documents too (Priority: P1)

A team keeps its own plan shape in spec-kit's override folder, or installs a preset that adds to the plan template. Stock spec-kit runs follow it. Companion runs do not, because Companion never asks spec-kit which template wins. After this change, rebuilding Companion's pipeline reads each spec, plan and tasks template the way spec-kit does, and when the winner is not the plain core template, Companion's step is told to follow it.

**Why this priority**: a team customisation that silently stops working under Companion is the defect this issue names.

**Independent Test**: add a plan-template override with an extra section, rebuild, and read the assembled plan command and the built copy.

**Acceptance Scenarios**:

1. **Given** a project with a plan-template override that adds a section, **When** the pipeline is rebuilt, **Then** a built copy of the override exists and the plan command tells the step to follow it.
2. **Given** a preset that appends text to the plan template, **When** the pipeline is rebuilt, **Then** the built copy carries the appended text and the plan command points at it.
3. **Given** a project that configured section swaps in its Companion settings and also has an override, **When** the pipeline is rebuilt, **Then** the swaps are applied on top of the override, not on top of the core template.
4. **Given** a project with no override, no preset and no configured swap, **When** the pipeline is rebuilt, **Then** the command bodies are byte-identical to today and no built copy is written.

### User Story 2 - Companion's built copy stays out of stock runs and survives a reinstall (Priority: P1)

Today Companion writes its reshaped template inside its own extension folder. Spec-kit treats that folder as an extension layer, so the copy leaks into stock runs, and a reinstall deletes it. The built copy moves to a folder the project owns.

**Why this priority**: the leak changes stock spec-kit behaviour, which Companion must never do.

**Independent Test**: rebuild with a configured swap, then ask spec-kit which layers resolve the plan template, then reinstall the extension.

**Acceptance Scenarios**:

1. **Given** a rebuild that wrote a built copy, **When** spec-kit resolves the plan template, **Then** no Companion extension layer appears.
2. **Given** a built copy, **When** the Companion extension is reinstalled with force, **Then** the built copy is still there.

### User Story 3 - The doctor says when Companion is ignoring a team template (Priority: P2)

An override or preset added after the last rebuild is not seen by Companion until the next one. The doctor names that case so the developer knows to rebuild.

**Why this priority**: it turns a silent miss into a visible one, but the rebuild itself is the fix.

**Independent Test**: add an override after a rebuild, then run the doctor.

**Acceptance Scenarios**:

1. **Given** an override on the plan template and no built copy, **When** the doctor runs, **Then** it reports that Companion runs ignore the override until a rebuild.
2. **Given** a built copy that no longer matches what spec-kit resolves, **When** the doctor runs, **Then** it reports it as out of date.
3. **Given** a project with no override and no preset, **When** the doctor runs, **Then** it reports nothing about templates.

## Edge Cases

- The project's spec-kit has no resolver script (older install, PowerShell only): the build reads the core template, exactly as today.
- The resolver fails for one template: the build stops before writing anything and names the template.
- A preset uses wrap or prepend rather than append: whatever spec-kit resolves is what Companion follows.
- The old built copy inside the extension folder is left from an earlier build: it no longer affects anything, because a reinstall replaces that folder.

## Requirements

### Functional Requirements

- **FR-001**: The pipeline build MUST read the spec, plan and tasks templates through spec-kit's own resolver, so overrides and presets win the way they do on stock runs.
- **FR-002**: Configured section swaps MUST be applied to the resolved template, not the core file.
- **FR-003**: When nothing is configured but the resolved template differs from the core template, the build MUST write a built copy and tell that step to follow it whole.
- **FR-004**: When nothing is configured and the resolved template is the core template, the build MUST write no copy and leave command bodies byte-identical.
- **FR-005**: The built copy MUST live in a project-owned folder outside Companion's extension folder.
- **FR-006**: Without a resolver script, the build MUST fall back to the core template.
- **FR-007**: A resolver failure MUST stop the build before anything is written.
- **FR-008**: The doctor MUST report an override or preset whose built copy is missing or no longer matches what spec-kit resolves.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In tests, an override's extra section and a preset's appended text both reach the built copy and the step's instructions, 2 of 2.
- **SC-002**: After a build, spec-kit's resolver lists zero Companion extension layers for the plan template.
- **SC-003**: A project with no customisation sees zero changed bytes in its command bodies.
- **SC-004**: The doctor flags 100% of tested missing or stale built copies and stays silent on an uncustomised project.

## Assumptions

- The rebuild that already runs when Companion's settings change is how a new override gets picked up; this slice does not add a new trigger.
- Only spec, plan and tasks templates are in scope, the three Companion's steps write.
- The built copy keeps the template's own file name inside the new folder.

## Verbatim Constraints

- `.specify/companion/built/`
- `.specify/scripts/bash/resolve-template.sh`
