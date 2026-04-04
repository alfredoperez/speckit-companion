# Spec: AI Provider Config Tree

**Slug**: 035-ai-provider-config-tree | **Date**: 2026-04-02

## Summary

Replace the broken Workflow section in the Steering sidebar with a unified AI Provider section that groups provider-specific config files (agents, commands/skills, hooks, plugins) under a single provider-named header with Project and User sub-groups. This gives users a clear, provider-aware view of all configuration files that steer their AI CLI tool.

## Requirements

- **R001** (MUST): Remove the Workflow section from the steering tree (currently broken — items don't expand/open)
- **R002** (MUST): Add an AI Provider section header showing the active provider name (e.g., "Claude Code", "Gemini CLI")
- **R003** (MUST): Under the provider section, show "Project" and "User" sub-groups containing provider-specific config files (agents, skills/commands, hooks)
- **R004** (MUST): For Claude Code provider, show installed plugins (from `~/.claude/plugins/installed_plugins.json`) as a sub-group under the provider section
- **R005** (SHOULD): Collapse the provider section by default so it doesn't overwhelm the tree
- **R006** (SHOULD): Preserve existing Steering Docs and SpecKit Files sections as-is (they remain outside the provider group)
- **R007** (SHOULD): Keep existing file watchers for agents, skills, hooks, and plugins so the tree auto-refreshes on changes
- **R008** (MAY): Show an empty-state message when the provider section has no config files

## Scenarios

### Provider section with Claude Code active

**When** the active AI provider is Claude Code and the workspace has agents, skills, hooks, and plugins
**Then** the tree shows a "Claude Code" collapsible header with "Project" (project agents, project skills) and "User" (user agents, user skills, plugins) sub-groups, plus a "Hooks" sub-group

### Provider section with non-Claude provider

**When** the active provider is Gemini or Copilot
**Then** the provider section shows only the config types that provider supports (e.g., Copilot shows agents only, no skills/hooks/plugins)

### No workflow section shown

**When** the steering tree loads
**Then** no "Workflow" header or workflow step references appear — the workflow section is fully removed

### Plugin visibility for Claude

**When** the user has Claude Code as their provider and `~/.claude/plugins/installed_plugins.json` exists with entries
**Then** plugins appear as a list under the provider section

## Out of Scope

- Workflow editor webview changes (separate concern)
- Adding/removing/installing plugins from the UI
- Supporting new provider types beyond the existing five
