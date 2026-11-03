# Feature Specification: The doctor diagnoses the real agent layout

**Feature directory**: `specs/650-doctor-agent-layout`
**Source**: #929 (item w22)

## User Scenarios & Testing

### User Story 1 - Find the agent that lost Companion (Priority: P1)

A project uses two agents. Spec Kit registers an extension's commands for the active integration only, so Companion's update or a second `integration install` leaves one agent without Companion, without a word. The doctor now lists each installed agent's layout (skills or commands, and the folder), names any agent missing Companion's commands with the command that fixes it, and warns when the `specify` CLI is not on PATH.

**Why this priority**: the missing commands only show up when the developer types one.

**Independent Test**: a project with claude carrying Companion and copilot without it; the doctor names copilot.

**Acceptance Scenarios**:

1. **Given** two installed agents and Companion only in one, **When** the doctor runs, **Then** it warns which agent is missing Companion and says `specify integration use <agent>`.
2. **Given** any installed agents, **When** the doctor runs, **Then** it notes skills or commands and the folder for each.
3. **Given** no `specify` on PATH, **When** the doctor runs, **Then** it warns.
4. **Given** a manifest an uninstalled agent left behind, **When** the doctor runs, **Then** that agent is ignored.

## Requirements

### Functional Requirements

- **FR-001**: The doctor MUST name every installed agent whose folder lacks Companion's specify command.
- **FR-002**: The doctor MUST note each installed agent's layout and folder.
- **FR-003**: The doctor MUST say when `specify` is not on PATH, as a note, since its PATH may not be the hooks' PATH.
- **FR-004**: Only agents in `installed_integrations` count.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In a two-agent project missing Companion in one agent, the doctor names that agent every time.

## Assumptions

- The VS Code install prompt offering `integration use` is UI and goes with the first-open install slice.

## Approach

- `apps/speckit-extension/scripts/doctor_checks.py`: `check_agents` reads `.specify/integrations/*.manifest.json` and `integration.json`.
- `apps/speckit-extension/scripts/doctor.py`: registers the `agents` check.
- `apps/speckit-extension/commands/speckit.companion.doctor.md`: describes it.
- `apps/speckit-extension/tests/test_doctor_agents.py`.
- Changelog line.
