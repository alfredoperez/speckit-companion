# Feature Specification: Doctor flags shared spec numbers; status survives a legacy console

**Source**: #929 (w30, w43)

## User Scenarios & Testing

### User Story 1 - The doctor names spec folders that share a number (Priority: P3)

Two runs that start together can mint the same number. The doctor now lists each shared number and its folders, once per run.

**Acceptance Scenarios**:

1. **Given** `634-a` and `634-b`, **When** the doctor runs, **Then** one warning names 634 and both folders.
2. **Given** timestamp-named folders or a clean `specs/`, **When** the doctor runs, **Then** there is no finding.

### User Story 2 - Status works on a legacy Windows console (Priority: P3)

On a console that cannot print the summary's arrow or dash, status prints ASCII stand-ins and never fails; its `RESOLUTION` JSON is ASCII-escaped, so it always parses.

**Acceptance Scenarios**:

1. **Given** `PYTHONIOENCODING=cp1252`, **When** status runs, **Then** it exits 0 and the `RESOLUTION` line parses.
2. **Given** a UTF-8 console, **When** status runs, **Then** the arrow still shows.

## Requirements

- **FR-001**: The doctor MUST name each sequential prefix shared by two or more spec folders, with the folders.
- **FR-002**: Prefixes of eight or more digits (dates and timestamps) MUST be ignored.
- **FR-003**: Status MUST exit 0 with a parseable `RESOLUTION` line on a cp1252 console, and keep its arrow on UTF-8.
