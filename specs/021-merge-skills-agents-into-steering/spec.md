# Spec: Consolidate Sidebar — Merge Skills & Agents, Remove MCP, Fix Workflow Commands

**Branch**: 021-merge-skills-agents-into-steering | **Date**: 2026-03-26

## Summary

Consolidate the sidebar by merging Skills and Agents into the Steering tree view, removing the broken MCP Servers view, and fixing the Workflow Commands section to recognize the new flexible `steps[]` workflow format. The current sidebar has too many top-level sections and the MCP view is fragile (shells out to `claude mcp list`/`get`, breaks on CLI changes). This creates a cleaner "project configuration" hub while fixing a real bug.

## Requirements

### Merge Skills & Agents into Steering

- **R001** (MUST): Skills appear as a collapsible group inside the Steering tree view, preserving the existing sub-grouping (User Skills, Project Skills, Plugin Skills) and click-to-open behavior
- **R002** (MUST): Agents appear as a collapsible group inside the Steering tree view, preserving the existing sub-grouping (User Agents, Project Agents, Plugin Agents) and click-to-open behavior
- **R003** (MUST): Remove the standalone `speckit.views.skills` and `speckit.views.agents` view registrations from `package.json`
- **R004** (MUST): All existing context menu actions, file watchers, and refresh behavior for Skills and Agents continue to work
- **R005** (SHOULD): The Steering view should show groups in this order: Global Rule, Project Rule, Steering Docs, SpecKit Files, Workflow Commands, Agents, Skills
- **R006** (SHOULD): Each merged group (Agents, Skills) should use a distinct header icon to maintain visual differentiation (e.g., `robot` for Agents, `symbol-misc` for Skills)
- **R007** (MUST): Provider-specific visibility logic is preserved — Skills only shown for Claude/Codex, Agents hidden when provider has no agent support

### Remove MCP Servers View

- **R008** (MUST): Remove the `speckit.views.mcp` view registration from `package.json`
- **R009** (MUST): Remove `src/features/mcp/` directory and all MCP-related registrations in `extension.ts`
- **R010** (MUST): Remove MCP-related settings, commands, and context menu entries from `package.json`
- **R011** (SHOULD): Remove MCP file watchers and references in `core/fileWatchers.ts` if any

### Fix Workflow Commands Loading

- **R012** (MUST): `resolveWorkflowCommandFiles` must read command names from `workflow.steps[].command` (the new `WorkflowStepConfig` format), not just the legacy `step-*` keys
- **R013** (MUST): Legacy `step-*` key resolution continues to work for backwards compatibility
- **R014** (SHOULD): Command file resolution should check both `.claude/commands/{cmd}.md` and the user-level `~/.claude/commands/{cmd}.md` paths

## Scenarios

### Viewing merged Steering sidebar

**When** user opens the SpecKit sidebar panel
**Then** Steering section contains all existing steering items PLUS Agents and Skills as collapsible groups at the bottom; MCP Servers section is gone

### Expanding Agents group within Steering

**When** user expands the "Agents" group in the Steering view
**Then** sub-groups (User Agents, Project Agents) appear, each expandable to show individual agent files with click-to-open

### Provider without Skills support (e.g., Gemini)

**When** AI provider is set to Gemini
**Then** Skills group does not appear in Steering view; Agents group appears if provider supports agents

### File watcher triggers refresh

**When** a SKILL.md or agent .md file is created/modified/deleted
**Then** the Steering view refreshes and the Skills/Agents groups update accordingly

### Workflow commands with new steps format

**When** a custom workflow uses the `steps[]` array with commands like `sdd.specify`, `sdd.plan`
**Then** all command files matching those step commands appear under "Workflow Commands" in the Steering view

### Workflow commands with legacy step keys

**When** a custom workflow uses legacy `step-specify: "my-custom.specify"` keys
**Then** command files for those steps still appear under "Workflow Commands"

## Out of Scope

- Merging Hooks into Steering
- Changing the internal SkillManager or AgentManager business logic
- Adding new functionality to Skills or Agents beyond what exists today
- Re-implementing MCP support (can be revisited later with a better approach)
