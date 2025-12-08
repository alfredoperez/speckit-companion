# Feature Specification: Claude Code Skills Explorer

**Feature Branch**: `001-skills`
**Created**: 2025-12-08
**Status**: Draft
**Input**: User description: "Add support for Claude Code Skills with new Skills section showing Plugin, User, and Project skills when Claude Code CLI is selected"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Available Skills (Priority: P1)

As a developer using Claude Code CLI, I want to see all available Skills in my workspace so that I can understand what capabilities are available and how Claude can assist me.

**Why this priority**: This is the core functionality - users need visibility into what Skills exist before they can manage or use them effectively.

**Independent Test**: Can be fully tested by selecting Claude Code as the CLI and verifying that the Skills section appears with any existing skills grouped by type (Plugin, User, Project).

**Acceptance Scenarios**:

1. **Given** Claude Code is selected as the active CLI, **When** I view the sidebar, **Then** I see a "Skills" section in the tree view
2. **Given** Claude Code is NOT selected as the active CLI (e.g., Gemini CLI or GitHub Copilot CLI), **When** I view the sidebar, **Then** I do NOT see the "Skills" section
3. **Given** Claude Code is selected and I have skills in `~/.claude/skills/`, **When** I view the Skills section, **Then** I see them grouped under "User Skills"
4. **Given** Claude Code is selected and I have skills in `.claude/skills/` (project root), **When** I view the Skills section, **Then** I see them grouped under "Project Skills"
5. **Given** Claude Code is selected and plugins with skills are installed, **When** I view the Skills section, **Then** I see them grouped under "Plugin Skills"

---

### User Story 2 - Inspect Skill Details (Priority: P2)

As a developer, I want to click on a skill to view its details (name, description, allowed tools) so that I can understand what the skill does and when to use it.

**Why this priority**: After seeing available skills, users need to understand what each skill does to effectively leverage them.

**Independent Test**: Can be fully tested by clicking on any skill item and verifying that skill details are displayed.

**Acceptance Scenarios**:

1. **Given** a skill exists with a valid SKILL.md file, **When** I click on the skill item, **Then** the SKILL.md file opens in the editor
2. **Given** a skill has a description in its frontmatter, **When** I hover over the skill item, **Then** I see the description as a tooltip

---

### User Story 3 - Refresh Skills List (Priority: P3)

As a developer, I want to refresh the skills list so that I can see newly added or removed skills without restarting VS Code.

**Why this priority**: Skills can be added/removed dynamically, and users need a way to update the view.

**Independent Test**: Can be fully tested by adding a new skill folder with SKILL.md, clicking refresh, and verifying it appears.

**Acceptance Scenarios**:

1. **Given** the Skills section is visible, **When** I click the refresh button, **Then** the skills list is re-scanned and updated
2. **Given** I add a new skill folder with SKILL.md, **When** I refresh the Skills list, **Then** the new skill appears in the appropriate group

---

### Edge Cases

- What happens when a skill folder exists but has no SKILL.md file? (Should be ignored, not shown)
- What happens when SKILL.md has invalid YAML frontmatter? (Show skill with warning indicator, name derived from folder)
- What happens when the user's home directory `~/.claude/skills/` doesn't exist? (Show empty "User Skills" group or hide it)
- What happens when no skills exist in any location? (Show empty state message in Skills section)
- How does the system handle skills with duplicate names across different types? (Show both, distinguished by their type group)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a "Skills" section in the tree view only when Claude Code is selected as the active CLI
- **FR-002**: System MUST detect and list skills from the user's personal directory (`~/.claude/skills/`)
- **FR-003**: System MUST detect and list skills from the project directory (`.claude/skills/`)
- **FR-004**: System MUST detect and list skills from installed Claude Code plugins (if detectable)
- **FR-005**: System MUST group skills by type: "Plugin Skills", "User Skills", "Project Skills"
- **FR-006**: System MUST read skill metadata (name, description) from the SKILL.md YAML frontmatter
- **FR-007**: System MUST allow users to open the SKILL.md file by clicking on a skill item
- **FR-008**: System MUST display the skill description as a tooltip on hover
- **FR-009**: System MUST provide a refresh action to re-scan and update the skills list
- **FR-010**: System MUST ignore directories that don't contain a valid SKILL.md file
- **FR-011**: System MUST handle gracefully when skill directories don't exist (hide empty groups or show empty state)

### Key Entities

- **Skill**: Represents a Claude Code skill with name, description, type (Plugin/User/Project), file path to SKILL.md, and optional allowed-tools list
- **Skill Type**: Enumeration of Plugin, User, Project indicating the source/scope of the skill
- **Skill Group**: A collapsible tree node containing skills of the same type

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify all available skills within 5 seconds of opening the Skills section
- **SC-002**: Users can access skill documentation (SKILL.md) with a single click
- **SC-003**: Skills list accurately reflects the current state of skill directories after refresh
- **SC-004**: The Skills section visibility correctly reflects the selected CLI (visible only for Claude Code)
- **SC-005**: 100% of valid skills (folders containing SKILL.md) are detected and displayed in the correct group

## Assumptions

- Plugin Skills detection may be limited based on what Claude Code exposes; if plugin skill locations are not discoverable, this group may show as empty or be hidden
- The extension already has a mechanism to detect which CLI is selected (Claude Code, Gemini CLI, GitHub Copilot CLI)
- SKILL.md files follow the documented format with YAML frontmatter containing at minimum `name` and `description` fields
