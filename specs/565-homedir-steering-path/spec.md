# Feature Specification: Consistent home-directory resolution for global steering files

**Feature**: Creating a global steering file always targets the real home directory
**Issue**: [#580](https://github.com/alfredoperez/speckit-companion/issues/580)
**Created**: 2026-08-16
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - Creating a global steering file puts it where the extension looks (Priority: P1)

A developer opens the Steering view and asks the extension to create their global guidance file. The extension creates the file in the user's home directory, opens it in the editor, and the Steering view immediately lists it. This holds on every operating system, including when the environment does not advertise a home directory through the usual variable — the extension falls back to what the operating system itself reports rather than writing into whatever folder the editor happened to start in.

**Why this priority**: This is the whole defect. Without it, the create action silently produces a file in an unpredictable location that the extension never displays again, and the user is left believing the feature is broken.

**Independent Test**: Trigger "create global steering file" in an environment where the home-directory variable is unset, then confirm the new file lands in the operating system's reported home directory and appears in the Steering view.

**Acceptance Scenarios**:

1. **Given** the environment does not define a home-directory variable, **When** the user creates the global steering file, **Then** the file is created inside the operating system's reported home directory, not in a folder relative to the current working directory.
2. **Given** the environment does define a home-directory variable pointing at the usual location, **When** the user creates the global steering file, **Then** the file is created in that same home directory exactly as it was before this change.
3. **Given** the global steering file has just been created, **When** the Steering view refreshes, **Then** the newly created file is listed, because it was written to the location the view watches and reads.
4. **Given** a global steering file already exists at the resolved location, **When** the user creates it again, **Then** the existing overwrite confirmation is still offered and cancelling still leaves the file untouched.

### User Story 2 - Home-directory resolution is consistent everywhere (Priority: P2)

Every part of the extension that needs the user's home directory resolves it the same way, so the folder that is watched for changes, the folder that is read to list files, and the folder that is written to when creating a file can never disagree.

**Why this priority**: Prevents this class of defect from recurring. The watchers were already corrected; this closes the last remaining inconsistent path so the three operations stay aligned.

**Independent Test**: Search the extension source for home-directory resolution and confirm a single approach is used throughout.

**Acceptance Scenarios**:

1. **Given** the extension source, **When** home-directory resolution is reviewed, **Then** no code path derives the home directory from the environment variable alone.
2. **Given** the reading, watching, and writing paths for global guidance files, **When** each resolves the home directory, **Then** all three produce the same folder.

## Edge Cases

- The environment variable for the home directory is unset entirely — resolution must still yield a valid absolute home directory.
- The environment variable is set but empty — this must be treated the same as unset, not as an empty relative path.
- The target folder does not yet exist — creation must still succeed, as it does today.
- The file already exists — the overwrite prompt and the cancel path must behave exactly as before.

## Requirements

### Functional Requirements

- **FR-001**: The extension MUST resolve the user's home directory from the operating system rather than from the home-directory environment variable when creating a global steering file.
- **FR-002**: The location written when creating a global steering file MUST match the location the extension watches for changes and reads when listing global steering files.
- **FR-003**: The extension MUST NOT create a global steering file at a path relative to the current working directory under any environment configuration.
- **FR-004**: Existing behavior on systems where the home-directory environment variable is set correctly MUST be unchanged, including the overwrite confirmation, the cancel path, opening the created file in the editor, and the confirmation notification.
- **FR-005**: The project MUST retain automated coverage proving the created file's location is derived from the operating system's home directory and not from the environment variable.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Creating a global steering file with no home-directory environment variable set produces the file in the operating system's home directory in 100% of attempts.
- **SC-002**: The created file appears in the Steering view without any manual refresh, on every supported operating system.
- **SC-003**: Zero code paths in the extension resolve the home directory from the environment variable.
- **SC-004**: The existing test suite continues to pass with no regressions.

## Assumptions

- The operating system's reported home directory is the correct target on all supported platforms; no separate Windows-specific override is needed beyond it.
- The empty-string fallback currently in place exists only to satisfy type requirements and has no intentional behavior worth preserving.
- No user has come to depend on a global steering file previously created at a relative path; no migration or cleanup of such a stray file is required.

## Approach

- Resolve the home directory in `src/features/steering/steeringManager.ts` from Node's operating-system home-directory helper instead of the environment variable, matching what the file watchers and the Steering explorer already do.
- Add the operating-system module import to that file.
- Add focused test coverage asserting the created file's path is rooted at the operating system's home directory even when the environment variable is unset or empty.
- No user-facing behavior changes on correctly configured systems, so no README or long-form documentation updates apply; the changelog gets a fix entry.

**Dependencies**: none. This is the follow-up to the watcher scoping fix already merged in PR #579.

## ADDED Requirements
<!-- capability: steering -->

### A file the view creates lands where the view watches and reads

Every location the view resolves for a user-scope file SHALL be derived from the operating system's reported home directory, so the folder written to when creating a file, the folder watched for changes, and the folder read when listing are always the same. Deriving any one of them from an environment variable instead lets them disagree — an unset variable yields a path relative to the editor's working directory, and the created file becomes invisible to the view that just created it.

#### Scenario: creating the global rules file with no home variable set
- **WHEN** the user creates the global rules file in an environment that does not define the home-directory variable
- **THEN** the file is created under the operating system's reported home directory
- **AND** the view lists it without a manual refresh
