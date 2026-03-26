# Spec: Fix Copilot CLI Command Invocation

**Branch**: 023-fix-copilot-cli-command | **Date**: 2026-03-26

## Summary

The Copilot CLI provider currently uses `ghcs` (GitHub Copilot in the Shell), which is a shell command *suggestion* tool — not a coding assistant CLI. When users select Copilot as their AI provider, the extension constructs `ghcs "$(cat "...")"` which is the wrong command. The provider should use `gh copilot` (the proper GitHub Copilot CLI) or allow users to configure the correct executable path.

## Requirements

- **R001** (MUST): Replace default `ghcs` command with the correct `gh copilot` CLI invocation so prompts are sent to GitHub Copilot's coding assistant, not the shell suggestion tool
- **R002** (MUST): Update `isInstalled()` check to validate the correct Copilot CLI command is available
- **R003** (MUST): Update the `speckit.copilotPath` configuration default from `ghcs` to the correct command
- **R004** (SHOULD): Preserve backward compatibility for users who have explicitly configured a custom `copilotPath`

## Scenarios

### Default Copilot invocation

**When** user triggers a SpecKit action with Copilot as the selected AI provider
**Then** the extension invokes `gh copilot` (not `ghcs`) with the prompt content

### Custom path configured

**When** user has set `speckit.copilotPath` to a custom value
**Then** the extension uses that custom value instead of the default

### Copilot not installed

**When** `gh copilot` is not available on the system
**Then** the extension shows an error message with correct install instructions (`gh extension install github/gh-copilot`)

## Out of Scope

- Adding support for VS Code Copilot Chat extension as a provider (separate feature)
- Changing the prompt format or content sent to Copilot
- Supporting Copilot agent mode or other advanced Copilot features
