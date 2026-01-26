# Feature Specification: Codex CLI Provider

**Feature Branch**: `012-codex-cli-provider`
**Created**: 2026-01-25
**Status**: Draft
**Input**: User description: "Add support for Codex CLI as a new AI Provider"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Select Codex CLI as AI Provider (Priority: P1)

Users who prefer OpenAI's Codex CLI over other AI assistants want to configure SpecKit Companion to use Codex as their primary AI provider for all spec-driven development workflows.

**Why this priority**: This is the foundational capability that enables all other Codex CLI features. Without provider selection, users cannot use any Codex-specific functionality.

**Independent Test**: Can be fully tested by opening VS Code, triggering the AI provider selection prompt, choosing "Codex CLI", and verifying the selection is persisted in settings.

**Acceptance Scenarios**:

1. **Given** SpecKit Companion is installed and no AI provider is configured, **When** the user opens a workspace, **Then** they see "Codex CLI" as an option in the AI provider selection prompt alongside existing providers.
2. **Given** the user selects "Codex CLI" from the provider prompt, **When** the selection is confirmed, **Then** the choice is saved to VS Code settings and persists across sessions.
3. **Given** a user has previously configured a different provider, **When** they change the setting to "Codex CLI" via VS Code settings, **Then** all subsequent SpecKit operations use Codex CLI.

---

### User Story 2 - Execute Prompts via Codex CLI (Priority: P1)

Users want to execute AI prompts through Codex CLI from within VS Code, whether through visible terminals for interactive sessions or headless execution for background tasks.

**Why this priority**: Core functionality that enables the extension's value proposition. Users need to be able to send prompts to Codex CLI for spec generation, planning, and task execution.

**Independent Test**: Can be fully tested by selecting a spec file, clicking "Refine with AI", and verifying the prompt is sent to Codex CLI in a terminal window.

**Acceptance Scenarios**:

1. **Given** Codex CLI is selected as the AI provider and is installed on the system, **When** the user triggers a prompt-based action, **Then** a terminal opens and executes the prompt using the `codex` command.
2. **Given** the user triggers a background operation, **When** the operation requires AI processing, **Then** Codex CLI executes in headless mode without visible terminal interruption.
3. **Given** Codex CLI is not installed on the system, **When** the user attempts to use Codex-dependent features, **Then** a helpful error message appears explaining that Codex CLI needs to be installed via `npm i -g @openai/codex`.

---

### User Story 3 - Execute Slash Commands (Priority: P2)

Users want to run SpecKit slash commands (like `/speckit.specify`, `/speckit.plan`) through Codex CLI in the terminal.

**Why this priority**: Enables the full SpecKit workflow integration with Codex CLI, but depends on basic prompt execution working first.

**Independent Test**: Can be fully tested by right-clicking a spec and selecting "Execute Plan" action, verifying the `/speckit.plan` command runs in Codex CLI terminal.

**Acceptance Scenarios**:

1. **Given** Codex CLI is the active provider, **When** the user triggers a slash command action, **Then** a terminal opens with the command prefilled and ready to execute.
2. **Given** the user wants to add additional context before executing, **When** they trigger a slash command with auto-execute disabled, **Then** the command appears in terminal but waits for user to press Enter.

---

### User Story 4 - Codex-Specific File Management (Priority: P2)

Users want the extension to recognize and manage Codex CLI's configuration files (like `AGENTS.md` for custom agents or configuration files) alongside their specs.

**Why this priority**: Provides parity with existing providers that manage steering files and enhances the user experience for Codex users.

**Independent Test**: Can be fully tested by creating a Codex agents file and verifying it appears in the SpecKit tree view.

**Acceptance Scenarios**:

1. **Given** the user has Codex CLI configured, **When** they view the SpecKit sidebar, **Then** they see Codex-specific configuration file locations (agents directory, rules, MCP config).
2. **Given** the user creates a new steering/agents file for Codex, **When** they save the file, **Then** it appears in the appropriate tree view section.

---

### Edge Cases

- What happens when the user switches from Codex CLI to another provider mid-session?
  - The extension updates all subsequent operations to use the newly selected provider without requiring a restart.
- How does the system handle when Codex CLI is selected but authentication is not configured?
  - Display a clear message that authentication is required and guide users to run `codex` to complete setup.
- What happens when running on Windows without WSL?
  - Codex CLI has experimental Windows/WSL support. The extension should detect the platform and provide appropriate guidance.
- How does the system handle network connectivity issues during Codex CLI execution?
  - Let Codex CLI handle its own error messages and display them in the terminal for user visibility.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST include "Codex CLI" as a selectable option in the AI provider configuration
- **FR-002**: System MUST detect whether Codex CLI is installed by checking if the `codex` command is available
- **FR-003**: System MUST execute prompts in a visible terminal using the `codex` command with appropriate flags
- **FR-004**: System MUST support headless/background execution for non-interactive AI operations
- **FR-005**: System MUST support slash command execution through Codex CLI
- **FR-006**: System MUST display a user-friendly error when Codex CLI is not installed, including installation instructions
- **FR-007**: System MUST handle WSL path conversion for Windows users (consistent with existing providers)
- **FR-008**: System MUST persist Codex CLI as the selected provider across VS Code sessions
- **FR-009**: System MUST define Codex-specific file paths for steering files, agents, and MCP configuration
- **FR-010**: System MUST integrate with the existing provider factory pattern to instantiate Codex CLI provider

### Key Entities

- **Codex CLI Provider**: Implementation of the IAIProvider interface for OpenAI's Codex CLI tool
- **Provider Paths Configuration**: Codex-specific paths for agents directory, rules, and MCP configuration files
- **Provider Type**: New 'codex' type added to the AIProviderType union

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can select Codex CLI as their AI provider and complete a full spec workflow (specify → plan → tasks) without errors
- **SC-002**: All existing SpecKit commands work identically whether using Claude Code, Gemini CLI, Copilot CLI, or Codex CLI
- **SC-003**: Users receive clear feedback within 3 seconds when Codex CLI is not installed
- **SC-004**: The provider selection UI clearly displays Codex CLI capabilities and limitations compared to other providers
- **SC-005**: No regression in functionality for existing Claude Code, Gemini CLI, or Copilot CLI users

## Assumptions

- Codex CLI follows a similar invocation pattern to Claude Code (command-line tool that accepts prompts)
- Codex CLI uses `codex` as the command name (based on npm package @openai/codex)
- Users will authenticate Codex CLI independently before using it with SpecKit Companion
- Codex CLI supports MCP (Model Context Protocol) for third-party tool integration, similar to Claude Code
- The extension does not need to handle Codex Cloud tasks - only local CLI execution
- Codex CLI's approval modes and safety features are handled by the CLI itself, not the extension

## Out of Scope

- Codex Cloud integration (remote/cloud-based task execution)
- Model selection within Codex CLI (users can use `/model` command directly in terminal)
- Image input handling specific to Codex (standard file operations apply)
- Codex-specific features like web search or code review agents (users access these directly via CLI)
- Authentication/API key management for Codex (handled by the CLI on first run)
