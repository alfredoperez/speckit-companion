# Feature Specification: Status is a script, not a summary

**Source**: #928 (w46)

## User Scenarios & Testing

### User Story 1 - Status prints the record's answer as is (Priority: P1)

Running the status command prints what the status script prints: the spec, its step and status, the decisions and the next action. The agent adds no summary of its own, so the answer reads the same every time.

**Why this priority**: A model summary can drift from the record and costs a reasoning pass for a fixed answer.

**Independent Test**: Run the script with `--plain` and compare it to today's output.

**Acceptance Scenarios**:

1. **Given** a spec with a record, **When** status runs, **Then** it prints the same fields as today, without the `RESOLUTION:` machine line.
2. **Given** a spec with nothing recorded, or no spec found, **When** status runs, **Then** it prints one line.
3. **Given** the status command body, **When** an agent reads it, **Then** it is told to print the output unchanged and add nothing.

## Requirements

### Functional Requirements

- **FR-001**: `status-context.py --plain` MUST print the human lines only, and say "No active spec found." on stdout when it cannot resolve one.
- **FR-002**: The status command MUST run the script with `--plain` and print its output unchanged.
- **FR-003**: Resume MUST keep reading the `RESOLUTION:` line, so the default output is unchanged.

## Success Criteria

- **SC-001**: Status output equals the script's `--plain` output.

## Assumptions

- A slash command always passes through the agent, so "no model call" is reworded to "no model summary": the agent runs one command and prints it.
