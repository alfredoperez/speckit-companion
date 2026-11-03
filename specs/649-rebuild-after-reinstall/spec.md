# Feature Specification: Rebuild the pipeline after a Companion reinstall

**Feature directory**: `specs/649-rebuild-after-reinstall`
**Source**: #929 (item w5)

## User Scenarios & Testing

### User Story 1 - A reinstall keeps the team's pipeline (Priority: P1)

A team customised `companion.yml` and built its pipeline. Later, `specify extension add companion --force`, `extension update`, an integration upgrade or a forced init replaces the extension folder with the shipped commands. `companion.yml` survives, but nothing rebuilds and nothing warns, so the assistant quietly runs the shipped default. With this change, when VS Code opens the project or sees the extension's files change, it previews the project's build; if the installed commands differ, it rebuilds and logs which commands it restored.

**Why this priority**: a customisation that silently stops applying is worse than none.

**Independent Test**: build a customised pipeline, overwrite one built command with the shipped body, trigger the check: the command carries the customisation again.

**Acceptance Scenarios**:

1. **Given** a customised `companion.yml` and installed commands that no longer match it, **When** VS Code opens the project, **Then** it rebuilds the pipeline and logs the commands it restored.
2. **Given** installed commands that match the project's build, **When** VS Code opens the project, **Then** nothing is written.
3. **Given** a project with no configuration of its own, **When** VS Code opens it, **Then** no build runs.

### User Story 3 - Copilot projects get the built bodies (Priority: P2)

A Copilot project keeps its commands in `.github/skills/`. The build's copy step did not know that folder, so Copilot never got the built bodies. With this change it does.

**Why this priority**: one supported assistant got no customisation at all.

**Independent Test**: a project with `.github/skills/speckit-companion-plan/SKILL.md`; build; the file carries the built body.

**Acceptance Scenarios**:

1. **Given** `.github/skills/speckit-companion-plan/SKILL.md`, **When** the pipeline builds, **Then** that file is refreshed from the built body.

## Requirements

### Functional Requirements

- **FR-001**: When the project has its own configuration, VS Code MUST preview the build at startup and when the extension's files change.
- **FR-002**: When the preview shows a difference, VS Code MUST rebuild and log the restored commands.
- **FR-003**: When nothing differs, or the project has no configuration of its own, nothing MUST be written.
- **FR-005**: The build's copy step MUST refresh `.github/skills/` entries.

## Success Criteria

### Measurable Outcomes

- **SC-001**: After a reinstall or `extension update`, the next VS Code start restores the customisation with no manual step.

## Assumptions

- The doctor does not check the build: `build-pipeline.py` is not shipped with the spec-kit extension, so a terminal install has no build to preview and no command to rebuild with. VS Code's startup rebuild uses its own bundled copy.
- An integration upgrade or forced init rewrites only the assistant's own copies; the build's preview cannot see those, so they are not covered here.
- A configuration edited ahead of its build is left to the person: only built commands newer than the configuration, yet different from its build, read as a reinstall.
- The folder list stays a fixed table with `.github/skills/` added, rather than read from `integration.json`.

## Verbatim Constraints

- `.github/skills/`
- `companion.yml`
