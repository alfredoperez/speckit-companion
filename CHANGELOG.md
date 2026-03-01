# Changelog

All notable changes to this project will be documented in this file.

## [0.5.0] - 2026-03-01

### New Features

- **File Reference Buttons**: Smaller, more compact pill buttons using VS Code's native codicon font instead of custom SVG icons
- **Short File Names**: File-ref buttons now show basename only for paths with directories, with full path in tooltip
- **Source File Button**: Always-visible source file button and new sidebar "Open Source" action (#25)
- **Custom Workflows UX**: Dynamic sub-commands and output channel logging for custom workflows (#24)
- **Spec Editor CTA**: Simplified create spec footer call-to-action (#23)
- **Clickable File References**: Code spans referencing files are now clickable buttons in the spec viewer (#22)
- **Qwen Code CLI**: Added Qwen Code as a new AI provider (#21)

### Bug Fixes

- **MCP Panel**: Resolved infinite spinner when Claude CLI is unavailable
- **Spec Viewer**: Brighter text, tighter layout, and cleaner navigation

### Improvements

- **SDD Worktree**: Strengthened worktree entry instructions with `pwd` verification and branch rename checks
- **SDD Commands**: Added AskUserQuestion to checkpoints and fixed minimal mode state
- **Project Structure**: Updated CLAUDE.md to reflect current codebase layout

## [0.4.0] - 2026-02-13

### Bug Fixes

- **Markdown Rendering**: Fixed underscore (`_`) in code and identifiers being rendered as italic in spec viewer (#14)
- **CLI Pre-flight Checks**: Added install checks for Copilot and Gemini CLI providers — users now see a helpful error with install instructions instead of a cryptic shell error (#19)
- **Provider-Aware Init**: Built-in agents (`.claude/agents/kfc/`) and system prompts are no longer created when using non-Claude providers (#19)
- **Permissions**: Simplified permission system and silenced agent init errors

## [0.3.5] - 2026-01-27

### Bug Fixes

- **Settings**: Fixed `speckit.defaultWorkflow` setting placement - was incorrectly defined outside `configuration.properties`, causing VS Code to report "Unknown Configuration Setting"

### New Features

- **Light Tasks Command**: Added `/speckit.light-tasks` command for simple flat task list generation without phases or dependency analysis

## [0.3.4] - 2026-01-27

### New Features

- **Default Workflow Setting**: New `speckit.defaultWorkflow` setting to auto-select a workflow for new features without prompting
- **Step-Tasks Support**: Added `step-tasks` as a workflow-configurable step alongside specify, plan, and implement
- **Dynamic Footer Buttons**: Approve button in spec viewer now dynamically updates based on document type and workflow progress

### Improvements

- Footer button text contextually shows "Generate Plan", "Generate Tasks", or "Implement Tasks" based on current phase
- Validates `defaultWorkflow` setting on extension activation with warning if configured workflow doesn't exist

## [0.3.1] - 2026-01-27

### New Features

- **Custom Workflows**: Define alternative workflows with custom commands for each step via `speckit.customWorkflows` setting
- **Workflow Selector**: Dropdown in spec editor to choose between default and custom workflows
- **Light Workflow Commands**: New streamlined commands (`light-specify`, `light-plan`, `light-implement`) for rapid development
- **Git Commands**: New `/speckit.commit` and `/speckit.pr` commands for workflow automation

### Improvements

- **Custom Commands**: Added `step` property to show commands in specific phases (spec, plan, tasks)
- **Custom Commands**: Added `tooltip` property for hover descriptions
- Simplified `customWorkflows` schema by removing `checkpoints` (handled by AI CLI)

## [0.3.0] - 2026-01-25

### New Features

- **Claude Permission Mode Setting**: New `speckit.claudePermissionMode` setting to choose between YOLO mode (bypass all permissions) or interactive permission prompts
- **Codex CLI Support**: Added OpenAI Codex CLI as a new AI provider with prompt template support

### Improvements

- **Spec Viewer**: Improved UX with inline line actions (refine, remove) on hover
- **Spec Viewer**: Refined typography and visual polish
- **Spec Viewer**: Modularized codebase for better maintainability
- **Steering**: Recursive document scanning for nested steering files
- **Steering**: Fixed refine button functionality

### Housekeeping

- Internal code refactoring and modularization

## [0.2.28] - 2026-01-02

### Improvements

- **Spec Editor**: Replace drag-and-drop with clipboard paste (Ctrl+V / Cmd+V) for image attachments
- **Spec Editor**: More reliable image thumbnail display
- **Workflow Editor**: Research tab now correctly appears under Plan phase
- **Workflow Editor**: Related docs sorted alphabetically for consistency
- Updated screenshots with higher quality images

### Housekeeping

- Removed unused legacy assets

## [0.2.26] - 2025-01-02

### New Features

- **Spec Editor**: New rich webview for creating specifications
  - Multi-line text editor with formatting preservation
  - Image attachments via file picker or drag-and-drop
  - Load existing specs as templates
  - Keyboard shortcuts (Ctrl+Enter to submit, Esc to cancel)
- Plus button in Specs view now opens the Spec Editor

### Improvements

- Automatic temp file cleanup for submitted specs
- VS Code theme integration for Spec Editor

## [0.2.21] - 2025-01-02

### Improvements

- Internal refactoring for better code maintainability
- Add architecture documentation (`docs/HOW_THIS_WORKS.md`)
- Add `/install-local` command for developers

## [0.2.11] - 2025-01-02

### New Features

- Add configurable Gemini CLI initialization delay setting (`speckit.geminiInitDelay`)
- Add setting to disable phase completion notifications (`speckit.notifications.phaseCompletion`)

### Improvements

- Increase default Gemini CLI init delay from 5s to 8s for better reliability

## [0.2.10] - 2025-01-02

### New Features

- Add SpecKit Files section to Steering view showing `.specify/` directory contents
- Display constitution, scripts, and templates from SpecKit project configuration
- File watcher for `.specify/` directory with automatic refresh

### Improvements

- Fixed contextual initialization message - only shows when valid workspace is open
- SpecKit files organized into collapsible categories with appropriate icons

## [0.2.9] - 2024-12-30

### New Features

- VS Code theme integration for workflow editor
- All hardcoded colors replaced with CSS custom properties mapped to VS Code theme variables
- Theme-specific fallbacks for light, dark, and high-contrast modes

### Improvements

- Compact layout with reduced header margins (~30% vertical space reduction)
- Typography uses VS Code font settings

## [0.2.0] - 2025-12-09

### New Features

- Improved Gemini CLI support with proper interactive mode handling

### Fixed

- Fix extension reload prompt when changing AI provider

## [0.1.7] - 2025-12-08

### New Features

- Add Skills view with YAML frontmatter support for Claude Code skills

### Fixed

- Remove Claude Code as automatic reviewer in PRs

## [0.1.3] - 2025-12-03

### New Features

- Add `autoExecute` parameter to `executeSlashCommand` for flexible CLI control

### Improvements

- Simplify permission setup flow (terminal only, no WebView popup)
- Make "Don't Ask Again" for init popup global across all projects
- Implement command now triggers when approving tasks phase

### Fixed

- Fix remove button only showing on removable lines (checkbox, bullet, numbered, user-story)

## [0.1.2] - 2025-12-02

### Fixed

- Fixed OpenVSX namespace to match publisher ID (alfredoperez)

## [0.1.1] - 2025-12-02

### Improvements

- Added OpenVSX publishing support for Cursor IDE users
- Updated acknowledgment section with project source

## [0.1.0] - 2025-12-02

### Initial Release

SpecKit Companion - VS Code companion for GitHub SpecKit, enabling spec-driven development with AI assistants.

### Features

- **Spec Explorer**: Visual tree view for managing feature specifications
- **Workflow Editor**: Custom markdown editor with action buttons for spec workflow
- **SpecKit CLI Integration**: Full support for SpecKit CLI commands (specify, plan, tasks, implement, clarify, analyze, checklist, constitution)
- **Steering Documents**: Manage user and project rules for AI context
- **Agents View**: Display and manage Claude Code agents
- **Hooks View**: View configured Claude Code hooks
- **MCP Servers View**: Monitor MCP server connections and status
- **Multi-AI Support**: Foundation for Claude Code, Gemini CLI, and GitHub Copilot CLI
- **Auto-detection**: Automatic detection of SpecKit CLI installation and workspace initialization
- **Install Guidance**: Welcome views guiding users through CLI installation and workspace setup
