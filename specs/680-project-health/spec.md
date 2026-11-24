# A project health view

**Source**: #1033

## User Scenarios & Testing

### User Story 1 - See whether the project is ready, in VS Code (Priority: P1)

A developer opens the SpecKit sidebar's overview and sees a "Project health" item: the Spec Kit CLI version, whether Companion is installed, the constitution's state and the configured AI agent. Each item that is not ready says so and offers the command that fixes it.

**Why this priority**: Companion assumes a ready repo today, and a missing piece shows up only as a confusing failure later.

**Independent Test**: open a project without Companion installed; the health item shows a warning with the install command.

**Acceptance Scenarios**:

1. **Given** a ready project, **When** the overview opens, **Then** every health row shows a check.
2. **Given** a missing piece, **When** the overview opens, **Then** its row warns and offers the command that fixes it, which runs in a visible terminal.

### User Story 2 - See the same on the Copilot board (Priority: P2)

The Copilot board shows a health panel that folds away, with the same items plus the session-worktree traps (no `node_modules` where the board needs them, Companion commands that are not committed files), each with its fixing command.

**Why this priority**: Copilot sessions run in fresh worktrees, where these traps are common.

**Independent Test**: open the board in a worktree with no `node_modules`; the panel names it and the command.

**Acceptance Scenarios**:

1. **Given** a ready project, **When** the board opens, **Then** the panel says all is ready and is folded.
2. **Given** a missing piece, **When** the board opens, **Then** the panel lists it with its command.

### Edge Cases

- The CLI is not installed: the version row warns and points to the install page.
- Health checks never block the board or the sidebar from loading.

## Requirements

### Functional Requirements

- **FR-001**: VS Code MUST show a Project health item with rows for the CLI version, Companion, the constitution and the AI agent.
- **FR-002**: A row that is not ready MUST warn and carry its fixing command, runnable in a visible terminal.
- **FR-003**: The board MUST show a foldable health panel with the same items plus the session-worktree traps.
- **FR-004**: Health checks MUST NOT block loading or write any file.
- **FR-005**: Tests, bundles, changelogs and docs MUST be updated.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Each missing piece is named with a command in both apps.
- **SC-002**: A ready project shows all checks.
- **SC-003**: All suites and the stale-bundle check pass.

## Non-goals

- Fixing anything automatically.
- A doctor run from the health view.

## Change-level rules

- No new runtime dependency.

## Verification plan

- Unit tests for each check in both apps; a tree-provider test in VS Code.

## Assumptions

- The existing install, init and upgrade commands are the fixes.
