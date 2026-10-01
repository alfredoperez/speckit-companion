# Initialize Workspace sets up the chosen assistant

**Issue**: #789 (remaining scope)

## User Scenarios & Testing

### User Story 1 - Initialize sets up the assistant already chosen (Priority: P1)

A user who picked an AI provider clicks Initialize Workspace in a project that has no Spec Kit files yet. Today the terminal runs a bare init, Spec Kit asks again which assistant to set up, and the answer can differ from the provider setting. After this change the terminal command names the assistant the provider setting resolves to, using the flag the installed Spec Kit understands, so the project is set up for the assistant SpecKit Companion will actually dispatch to.

**Why this priority**: it is the open half of the issue and the case every new user hits.

**Independent Test**: set the provider to Codex, run Initialize Workspace, and read the terminal command.

**Acceptance Scenarios**:

1. **Given** a current Spec Kit CLI and the Codex provider, **When** the user runs Initialize Workspace, **Then** the terminal runs `specify init . --integration codex`.
2. **Given** an older Spec Kit CLI whose init help lists `--ai` and not `--integration`, **When** the user runs Initialize Workspace, **Then** the terminal runs `specify init . --ai <agent>`.
3. **Given** the init help cannot be read in time, **When** the user runs Initialize Workspace, **Then** the terminal uses `--integration`.
4. **Given** any project, **When** the command runs, **Then** the workspace path never appears in the command text; the terminal starts in the project folder instead.

### User Story 2 - Windsurf never gets a flag Spec Kit rejects (Priority: P2)

IDE Chat on a Windsurf host resolves to the `windsurf` agent, which current Spec Kit does not list as an integration and which only the old `--ai` flag knew. The init and upgrade commands pass `--ai windsurf` on an older CLI that lists `--ai` and not `--integration`, and otherwise run without an agent flag so Spec Kit's own picker asks, instead of failing on an unknown option.

**Why this priority**: it affects one host, but today Upgrade Project and Upgrade All fail outright for it on a current CLI.

**Independent Test**: with IDE Chat on Windsurf, run Initialize Workspace and Upgrade Project against a current CLI and an older one, and read the terminal commands.

**Acceptance Scenarios**:

1. **Given** IDE Chat on Windsurf and an older CLI that lists `--ai` and not `--integration`, **When** the user runs Initialize Workspace or Upgrade Project, **Then** the command carries `--ai windsurf`.
2. **Given** IDE Chat on Windsurf and a current CLI, **When** the user runs Initialize Workspace, **Then** the terminal runs `specify init .` with no agent flag.
3. **Given** IDE Chat on Windsurf, **When** the user runs Upgrade All, **Then** the reinstall is followed by `specify init --here --force` with no agent flag.

### Edge Cases

- The CLI's help lists both flags: the current flag wins.
- The help probe times out or the CLI is missing: the current flag is used, as Upgrade Project already does.
- An unknown or unset provider resolves to Claude, as it does today.

## Requirements

### Functional Requirements

- **FR-001**: Initialize Workspace MUST name the agent the provider setting resolves to, with `--integration` on a CLI that supports it.
- **FR-002**: Initialize Workspace MUST use `--ai` only when the installed CLI's init help lists `--ai` and not `--integration`, the same rule Upgrade Project follows.
- **FR-003**: Initialize Workspace MUST keep its current shape otherwise: the current folder as `.`, no forced overwrite, and the workspace path never in the command text.
- **FR-004**: For the `windsurf` agent, every init command MUST pass `--ai windsurf` when the CLI lists `--ai` and not `--integration`, and otherwise pass no agent flag.
- **FR-005**: Initialize Workspace, Upgrade Project and Upgrade All MUST build their agent arguments from one shared rule so they cannot disagree.
- **FR-006**: The change MUST NOT add any UI for switching integrations or call `specify integration`.

## Success Criteria

### Measurable Outcomes

- **SC-001**: For each provider, the Initialize Workspace command names the same agent Upgrade Project does.
- **SC-002**: No init command sent to a current Spec Kit CLI carries a flag or agent that CLI rejects.
- **SC-003**: Every existing upgrade test still passes unchanged in what it asserts for non-Windsurf agents.

## Assumptions

- Upgrade All always runs on the CLI it has just reinstalled, so it treats the CLI as current without probing.
- Falling back to the interactive picker is better for Windsurf than an error, because it matches what Initialize Workspace did before.

## Verbatim Constraints

- `specify init . --integration <agent>`
- `specify init . --ai <agent>`
- `--ai windsurf`

## Approach

- `apps/vscode/src/speckit/specKitAgent.ts`: add one pure helper that turns an agent and the CLI's flag (`--integration` or `--ai`) into the agent arguments, returning nothing for `windsurf` on `--integration`.
- `apps/vscode/src/speckit/detector.ts`: `initializeWorkspace` probes the flag with the existing `detectAgentFlag` and appends the helper's arguments to `specify init .`; `upgradeProject` and `upgradeAll` build their arguments through the same helper (Upgrade All passes `--integration` without probing).
- Tests beside the code: `apps/vscode/src/speckit/__tests__/specKitAgent.test.ts` for the helper, `apps/vscode/src/speckit/__tests__/detector.test.ts` for the three commands.
- Docs: one Fixed line in root `CHANGELOG.md` `[Unreleased]`; fold the init rule into `capabilities/extension-services/set-up-and-update.spec.md`.

## ADDED Requirements
<!-- capability: set-up-and-update -->

### Initialize Workspace and Upgrade Project name the configured provider's agent with `--integration`
<!-- touches: apps/vscode/src/speckit/detector.ts, apps/vscode/src/speckit/specKitAgent.ts -->

Initialize Workspace and Upgrade Project SHALL name the agent the configured AI provider resolves to with `--integration`, and use `--ai` only when the installed CLI's init help lists `--ai` and not `--integration`. Upgrade All reinstalls the CLI first, so it uses `--integration` without checking the help.

#### Scenario: a current CLI
- **WHEN** the provider is Codex and the user runs Initialize Workspace against a CLI whose init help lists `--integration`
- **THEN** the terminal runs `specify init . --integration codex`

#### Scenario: an older CLI
- **WHEN** the installed `specify init --help` lists `--ai` but not `--integration`
- **THEN** Initialize Workspace and Upgrade Project name the provider's agent with `--ai` instead

#### Scenario: Upgrade All on an older CLI
- **WHEN** the user picks Upgrade All while the installed CLI's init help lists only `--ai`
- **THEN** the init that follows the reinstall names the agent with `--integration`

### Windsurf is named with `--ai` or not at all
<!-- touches: apps/vscode/src/speckit/detector.ts, apps/vscode/src/speckit/specKitAgent.ts -->

An agent current Spec Kit no longer lists as an integration (`windsurf`, which IDE Chat on Windsurf resolves to) SHALL be passed as `--ai windsurf` when the installed CLI's init help lists `--ai` and not `--integration`, and otherwise with no agent flag, so Spec Kit's own picker asks instead of the command failing on an unknown option.

#### Scenario: IDE Chat on Windsurf with an older CLI
- **WHEN** the provider is IDE Chat on Windsurf and the CLI's init help lists `--ai` and not `--integration`
- **THEN** Initialize Workspace and Upgrade Project carry `--ai windsurf`

#### Scenario: IDE Chat on Windsurf with a current CLI
- **WHEN** the provider is IDE Chat on Windsurf and the CLI's init help lists only `--integration`
- **THEN** Initialize Workspace runs `specify init .`, and Upgrade Project and Upgrade All carry no agent flag

## MODIFIED Requirements
<!-- capability: set-up-and-update -->

### CLI install, init and upgrade run in a terminal the user can watch
<!-- touches: apps/vscode/src/speckit/detector.ts, apps/vscode/src/speckit/cliCommands.ts -->

Installing the CLI, initialising the workspace and the upgrade choices (`SpecKit: Upgrade` offers Upgrade All, Upgrade Project, Upgrade CLI and Update spec-kit Extension) SHALL each run as a command in a visible integrated terminal and offer a window reload for when it finishes. Commands that act on a project SHALL refuse with a message when no folder is open.

#### Scenario: upgrading a project
- **WHEN** the user picks Upgrade Project
- **THEN** a terminal opens at the project root and re-runs the project init in place, and a message offers Reload Window

#### Scenario: no folder is open
- **WHEN** the user runs Initialize Workspace or Upgrade Project with no folder open
- **THEN** a message says a folder is needed and no terminal opens
