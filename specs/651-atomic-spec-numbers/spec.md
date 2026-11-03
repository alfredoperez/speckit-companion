# Feature Specification: Mint spec folders atomically and honour feature_numbering

**Feature directory**: `specs/651-atomic-spec-numbers`
**Source**: #929 (item w12)

## User Scenarios & Testing

### User Story 1 - Two runs never share a number (Priority: P1)

Two specify or auto runs start at once. Each one listed `specs/`, added one to the highest number, and both reported success with two `001-` folders. This repo already holds three folders starting `634-`. With this change one script picks the number and creates the folder under a lock, so the second run gets the next number.

**Why this priority**: duplicate numbers break every tool that finds a spec by its number.

**Independent Test**: start six mints at once; six different numbers come back.

**Acceptance Scenarios**:

1. **Given** six runs started together, **When** each mints a folder, **Then** each gets its own number.
2. **Given** a new folder, **When** it is minted, **Then** `.specify/feature.json` points at it.

### User Story 2 - Companion follows the project's numbering (Priority: P2)

A team set `feature_numbering` to timestamp. Stock spec-kit made `20261103-142501-name` folders and Companion made `645-name`. With this change Companion follows the setting.

**Why this priority**: mixed numbering in one project is confusing, not broken.

**Independent Test**: set timestamp numbering; mint; the folder starts with a timestamp.

**Acceptance Scenarios**:

1. **Given** `feature_numbering: timestamp`, **When** a folder is minted, **Then** it starts with `YYYYMMDD-HHMMSS-`.
2. **Given** timestamp folders beside numbered ones, **When** a numbered folder is minted, **Then** the timestamps do not move the count.

## Requirements

### Functional Requirements

- **FR-001**: One script MUST pick the number and create the folder under a cross-process lock.
- **FR-002**: The script MUST point `.specify/feature.json` at the new folder and print its path.
- **FR-003**: The script MUST follow `feature_numbering` in `.specify/init-options.json`.
- **FR-004**: The specify and auto steps MUST call the script instead of choosing a number; New Spec goes through specify.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Concurrent mints never produce two folders with one number.
- **SC-002**: A timestamp project gets timestamp folders from Companion.

## Approach

- `apps/speckit-extension/scripts/mint-spec-dir.py` (new), on the packing list.
- `apps/speckit-extension/nodes/specify/resolve-dir.md` and `nodes/auto/resolve-dir.md` call it; the built commands are rebuilt.
- `upstreams.yml`: timestamp numbering is no longer unsupported.
- `apps/speckit-extension/tests/test_mint_spec_dir.py`.
- Changelog line.
