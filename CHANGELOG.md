# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### New Features

- **Group Header Bulk Actions**: Right-click the Active, Completed, or Archived group header in the Specs sidebar to apply a lifecycle transition to every visible spec at once (Mark all as Completed / Archive all / Reactivate all). Gated by a confirmation dialog with the post-skip count.

## [0.14.0] - 2026-04-27

### New Features

- **Pinned Viewer Header + Responsive TOC Sidebar**: Spec viewer header stays pinned while scrolling, and a responsive table-of-contents sidebar links to each H2/H3 for fast navigation in long specs (#139)
- **Onboarding Card for Zero-Spec Workspaces**: Replaces the silent empty welcome view with a "Create your first spec" card that links to docs and triggers the spec editor in one click (#137)
- **Always-Show SpecKit Icon + Empty-State Welcome**: The activity-bar icon now appears whether or not a workspace is open, and shows a contextual empty state instead of disappearing — fixes the "extension didn't load" confusion on first install (#134)
- **Reveal in Finder + Explorer View from Tree**: Tree view file items now expose "Reveal in OS Finder" and "Reveal in Explorer View" context-menu actions (#132)

### Improvements

- **README Refresh**: Top-of-page positioning rewritten, latest features documented, factual gaps fixed, and a maintenance rule added so the README stays current per release (#143)
- **Sample Specs Section in README**: Points to in-repo example specs so new users have a clear "what does good look like" reference (#136)
- **Polished Related-Tab Styles**: Related-tab styling now matches the step-tab chip language for visual consistency in the spec viewer (#133)

### Bug Fixes

- **Viewer State Display**: Fixed branch chip rendering, in-flight `%` pill, and substep label in the spec viewer (#131)
- **Current-Step Chip Contrast**: Improved current-step chip contrast on purple themes so the active step stays readable (#130)

## [0.13.0] - 2026-04-24

### New Features

- **Color-Coded Badge Statuses**: Every canonical spec status (draft, specifying, specified, planning, planned, tasking, ready-to-implement, implementing, completed, archived) now has a distinct color treatment — accent in-progress tier with gentle border breath, success-subtle intermediate-done tier, muted draft tier — so header badges read at a glance (#125)
- **Spec Header Layout Refresh**: Spec viewer header moves the created-date to a small right-aligned muted pill in row 1, drops the "Created:" prefix, gives the branch tag a purple treatment with a `git-branch` codicon, and promotes the title to its own line (#125)
- **Live Elapsed Timer on Step Tabs**: Step tabs for running work now show a live elapsed timer (`12s` / `3m 22s` / `2h 15m`) next to the in-flight pill, derived from `stepHistory.startedAt` so it survives webview reloads. A step-complete notification fires when `completedAt` transitions (#120)
- **Specs Tree Fuzzy Filter**: Fuzzy filter input over the specs tree for quick navigation (#121)
- **Specs Tree Sort Options**: Sort the specs tree by name, date, or status (#122)

### Improvements

- **Step Tab Visual Polish**: Brighter completed-step labels, inset accent ring + tinted fill on the current step (wraps the whole tab even when in-flight), harmonized label colors (icons/rings carry state), extra breathing room on in-flight tabs so the working pulse doesn't crash into the connector (#125)
- **Storybook Coverage**: One story per canonical status for `Primitives/Badge` and `Viewer/SpecHeader`, plus `Viewer/StepTab` stories for current+in-flight, elapsed-timer bands, and a 4-step `AllStates` row (#125)

### Bug Fixes

- **Codex Cross-Shell Command Pipe**: Codex provider now uses PowerShell-compatible command substitution instead of Unix `<` input redirection, and honors the `script` setting from `.specify/init-options.json` so Windows PowerShell users can run SpecKit commands without parser errors (#124)

## [0.12.1] - 2026-04-22

### New Features

- **Two-Row Viewer Header**: Spec viewer header now renders in two rows — status/branch badges above the title — instead of a single cramped flex row; the redundant `spec.md` / `plan.md` / `tasks.md` pill under the divider is gone (#119)
- **Tree Group Counts**: Spec tree group headers now display the count of specs in each group (#101)
- **Live Viewer Repaint**: Viewer repaints automatically on approve/regenerate and forces an AI completion marker for snappier feedback (#117)
- **Unified Webview Tokens + Undo Safety**: Webview design tokens unified, assets bundled, and undo safety added for editor actions (d902ad4)

### Improvements

- **Quieter Viewer Colors + Larger Mermaid**: Title/heading colors softened, and flowchart/sequence mermaid diagrams render at natural width with larger text instead of shrinking to the container (#118)
- **SDD Branch Auto-Creation**: `.sdd.json` now supports a `branchStage` + `branchNameFormat` to auto-create feature branches at specify or implement (#100)

### Bug Fixes

- **Viewed-Step Checkmark Preserved**: Clicking a completed step tab no longer hides its ✓; the accent outline marker around the currently viewed tab has been restored (#119)

## [0.12.0] - 2026-04-20

### New Features

- **Canonical `.spec-context.json`**: `.spec-context.json` is the single source of truth for workflow state, derived by the extension and consumed by the viewer (#83, #84, #86)
- **Context Preamble for AI Prompts**: AI prompts automatically include a context-update preamble so providers keep `.spec-context.json` in sync through the lifecycle (#85)
- **Provider Registry & OpenCode Support**: AI providers moved to a registry pattern; OpenCode joins Claude Code, Gemini, Copilot, Codex, and Qwen (#87)
- **Multi-Select Bulk Status Commands**: Select multiple specs in the tree and change status (archive, complete, reactivate) in one action (#88)
- **Locked Future Steps**: Workflow tabs lock future steps while a step is running and expose tooltips to explain each action (#90)
- **Collapse/Expand All**: Spec tree now has a collapse/expand toggle with reduced flicker and tighter sub-file indentation (#95)
- **Reveal Spec Folder**: New tree context menu to reveal a spec's folder in Finder / Explorer (#98)

### Improvements

- **Step Completion Inference**: Completion is inferred from file state when `stepHistory` is missing, so older specs render correctly (#87, #92)
- **Cleaner Slash Command Routing**: Preamble is passed via `--append-system-prompt` so slash commands arrive cleanly to the AI CLI (#96)
- **Hidden Launch Prompts**: Prompt content is dispatched via a temp file to keep the terminal view clean (#82)

### Bug Fixes

- **Numeric Spec Sorting**: Specs sort by numeric prefix so `069` appears above `068` and `067` (#97)
- **Incomplete Spec-Context Reconciliation**: Viewer now reconciles partial `.spec-context.json` files and keeps lifecycle buttons enabled correctly (#93)
- **Tab Clicks No Longer Mutate Workflow**: Clicking a step tab in the viewer no longer changes `currentStep` in `.spec-context.json` (#89)

## [0.11.0] - 2026-04-10

### New Features

- **Floating Toast Notifications**: Upgraded terminal toast to a floating notification with slide-in/fade-out animations, positioned at bottom-right with auto-dismiss (#81)
- **Command Format Setting**: Added `speckit.commandFormat` setting to switch between dot (`speckit.plan`) and dash (`/speckit-plan`) command formats for compatibility with different speckit versions (fixes #73, #76)
- **Transition Logging**: `.spec-context.json` now logs step transitions with timestamps for debugging and audit (#75)
- **Archive Button Repositioned**: Archive button moved to left side of footer for better UX flow (#77)

### Improvements

- **Preact Migration**: Spec-viewer webview migrated from vanilla DOM to Preact with Storybook support (#74)

### Bug Fixes

- **Bullet Point Rendering**: Fixed bullet points not rendering correctly in lists containing code blocks (#79)
- **List Item Spacing**: Reduced excessive spacing between list items in spec viewer (#80)
- **Storybook Preact Aliases**: Added Preact aliases to resolve "React is not defined" errors in Storybook

## [0.10.0] - 2026-04-05

### New Features

- **Spec Context as Source of Truth**: `.spec-context.json` is now the single source of truth for workflow state, replacing scattered markdown-based heuristics. Badge text, created/last-updated dates, and step progress are all derived from context data (#61, #62)
- **Redesigned Spec Viewer Header**: Structured metadata layout showing badge, status, created date, and last-updated date from spec-context (#64)
- **Workflow Command Buttons**: Workflow-defined `commands` now render as action buttons in the spec-viewer footer alongside primary CTAs (#69)
- **Mermaid Diagram Zoom**: Mermaid diagrams in the spec viewer now include zoom controls (+, −, Reset) for navigating large diagrams
- **Provider Config Tree**: Steering sidebar restructured with Project/User groups for clearer organization of AI provider config files (#55)
- **Provider-Aware Commands**: AI provider prompts now include spec-context instructions and use provider-specific command formatting

### Bug Fixes

- **Step Completion Badges**: Working/active indicator no longer shows on completed steps — uses `stepHistory.completedAt` for accurate status (#67)
- **Workflow Persistence**: Workflow selection persists correctly across spec lifecycle; default renamed to "speckit" to prevent accidental overwrites (#60)
- **Explorer Status Icons**: Prefer SDD `step` field for explorer status icon; checklists now appear under Specify phase (#65)
- **Plan Sub-Files**: Combined `subFiles` and `subDir` in `getStepSubFiles` so Plan children display correctly (#68)
- **Read-Only Tree Rendering**: New `resolveWorkflow()` avoids writing `.spec-context.json` during tree rendering and viewer init
- **Disabled Step Tabs**: Step tabs for non-existent files are now disabled instead of being silently clickable
- **Completed Status**: Uses explicit `next=done` for completed status instead of fragile substep heuristics (#57)
- **Spec Directory Discovery**: Directories with `.spec-context.json` (SDD in-progress specs) now appear in explorer even without markdown files

### Improvements

- **Sorted Completed/Archived Specs**: Completed and archived specs now sort by creation date (newest first), matching active spec behavior
- **Unified Step Context Schema**: Simplified step context field names for consistency (#66)
- **Centralized Constants**: Magic strings extracted into named constants (#59)
- **Green Working Pulse**: Active step animation uses green (success) color instead of accent blue
- **Inline Code Styling**: Removed heavy box styling from inline code highlights for cleaner appearance
- **Editor Comment Area**: Inline editor comment section has a visible border for better visual separation
- **Smaller Line Actions**: Reduced add-button size for less visual clutter

### Documentation

- Updated architecture docs, how-it-works guide, and CLAUDE.md to reflect current codebase (#63)

## [0.9.3] - 2026-04-02

### New Features

- **Unified Permission Mode**: New `speckit.permissionMode` setting replaces per-provider settings (`claudePermissionMode`, `copilotPermissionMode`, `qwenYoloMode`). Values: `"interactive"` (default, recommended) and `"auto-approve"` (YOLO). Applies to Claude, Copilot, and Qwen. (#7)

### Improvements

- **Spec Viewer Lifecycle Buttons (BETA)**: Overhauled lifecycle buttons and simplified status system in the spec viewer. Status-based sidebar grouping with colored step indicators.
- **Safe Default**: Extension no longer defaults to bypass-permissions mode. New installs start in interactive mode.
- **Removed Permission Gate**: Removed the PermissionManager/PermissionWebview startup dialog — no permission prompt on extension activation.
- **Specs View Always Visible**: Specs sidebar view is no longer gated behind a visibility setting — always shows when a workspace is open.

### Breaking Changes

- Per-provider permission settings removed: `speckit.claudePermissionMode`, `speckit.copilotPermissionMode`, `speckit.qwenYoloMode`. Use `speckit.permissionMode` instead.
- Setting `speckit.views.specs.visible` removed — Specs view is always visible.

## [0.9.2] - 2026-04-01

### New Features

- **Active/Earlier Grouping**: Specs in the explorer tree are now grouped into "Active" (modified today, expanded) and "Earlier" (older, collapsed), with active specs sorted newest-first (#48)
- **Spinning Indicator**: Spec node shows a spinning icon when a workflow step command is running
- **Missing File Indicator**: Steps with no file show "not created" in dim text for clear visibility

### Improvements

- **Cleaner Tree View**: Removed static circle status indicators and step-specific icons for a less cluttered appearance
- **Label Rename**: Default workflow step "Specify"/"Specs" renamed to "Specification" for clarity

### Bug Fixes

- **Dimmed Tree Items**: Fixed git-ignored spec files appearing grayed out by removing `resourceUri` from tree items (#47)

## [0.9.1] - 2026-03-31

### New Features

- **Workflow Commands**: Workflows can now define `commands` — extra action buttons that appear next to the primary action for a given step (e.g., an "Auto Mode" button next to Submit in the spec editor) (#45)
- **Action Toast & Auto-Navigate**: Spec viewer now shows a toast notification after running an action and automatically navigates to the next workflow phase (#44)

### Bug Fixes

- **Terminal Timing**: Replaced fixed 800ms `setTimeout` with VS Code's shell integration API (`onDidChangeTerminalShellIntegration`) for detecting terminal readiness before sending commands — prevents commands from being lost on slow shell startup (#46)
- **Extension Host Cleanup**: Audited all disposables in `activate()` to ensure clean shutdown without "closing extension host" warnings

### Improvements

- **Shell Integration Fallback**: Terminals on VS Code versions below 1.93 (lacking shell integration events) gracefully fall back to a 5-second timeout
- **Shared Utility**: New `waitForShellReady` utility used consistently across all 5 AI providers and steering manager

## [0.8.0] - 2026-03-26

### New Features

- **Scoped Related Docs**: Related documents in the spec viewer are now scoped to their parent workflow step (#38)
- **Welcome Buttons**: Conditional welcome buttons for init and constitution setup in sidebar views (#37)

## [0.7.0] - 2026-03-26

### New Features

- **Optional SpecKit CLI**: Extension now works without SpecKit CLI initialization (#35)
- **Copilot permission mode**: New `speckit.copilotPermissionMode` setting to control auto-approval (`yolo`/`default`)

### Bug Fixes

- **Copilot CLI command**: Replaced `ghcs` (shell suggestion tool) with `copilot` CLI — the correct coding assistant executable (#36)
- **Copilot non-interactive mode**: Added `-p` flag for prompt mode and `--yolo` for auto-approving shell actions
- **Copilot slash commands**: Strip leading `/` from prompts since Copilot CLI doesn't use slash commands

### Improvements

- **Steering sidebar consolidation**: Merged agents, skills, and hooks into the steering view (#34)
- **CLI defaults constant**: Added `CLIDefaults` constant for centralized provider executable names

## [0.6.0] - 2026-03-22

### New Features

- **Configurable Spec Directories**: New `speckit.specDirectories` setting with glob pattern support for flexible project layouts (e.g., `openspec/changes/*/specs/*`). Empty directories auto-hidden from sidebar (#31)
- **Action-Only Workflow Steps**: Workflow steps now support an `actionOnly` flag for commands that don't produce output files (#31)
- **Flexible Workflow Steps**: Added `includeRelatedDocs` support for surfacing related documents in the workflow viewer (#30)
- **Feedback Entry Points**: Settings panel now shows Report a Bug, Request a Feature, and Rate on Marketplace items with dedicated icons (#29)
- **Inline Spec Delete**: Trash icon appears on hover for spec rows in the sidebar (#29)

### Bug Fixes

- **Status Bar Messages**: Replaced noisy info popup notifications with unobtrusive status bar messages (#27, #28)

### Improvements

- **README Overhaul**: Updated documentation with blog screenshots and refreshed configuration guide (#32)
- **Spec Viewer Overhaul**: Document scanner, phase calculation, and navigation rebuilt for custom workflow steps and configurable directories
- **Explorer Deduplication**: Spec explorer now deduplicates spec names across multiple directories

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
