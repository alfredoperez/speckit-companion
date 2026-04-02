# Spec: Permission Mode Control

**Slug**: 033-permission-mode-control | **Date**: 2026-04-02

## Summary

Unify the per-provider permission/YOLO settings into a single `speckit.permissionMode` setting that defaults to safe interactive mode. Each provider translates the setting into its own CLI flag. This replaces `claudePermissionMode`, `copilotPermissionMode`, and `qwenYoloMode` with one consistent control, so users don't need to configure each provider separately.

## Requirements

- **R001** (MUST): Add a single `speckit.permissionMode` setting with values `"default"` and `"bypass"`, defaulting to `"default"`
- **R002** (MUST): Claude provider maps `"bypass"` → `--permission-mode bypassPermissions`
- **R003** (MUST): Copilot provider maps `"bypass"` → `--yolo`
- **R004** (MUST): Qwen provider maps `"bypass"` → `--yolo`
- **R005** (MUST): Gemini and Codex providers ignore the setting (no bypass flag available)
- **R006** (MUST): Remove deprecated per-provider settings (`claudePermissionMode`, `copilotPermissionMode`, `qwenYoloMode`) from package.json
- **R007** (MUST): Remove the Claude-specific PermissionManager/PermissionWebview setup flow — no permission gate needed in default mode, and bypass mode doesn't need a confirmation dialog
- **R008** (SHOULD): Add clear setting description explaining the trade-off (default = interactive prompts, bypass = skip all prompts)
- **R009** (MAY): Log a deprecation warning if old per-provider settings are still present in user config

## Scenarios

### User installs extension fresh

**When** a new user installs the extension and selects any provider
**Then** the CLI runs in default interactive mode (no bypass flags), and no permission setup dialog is shown

### User enables bypass mode

**When** user sets `speckit.permissionMode` to `"bypass"`
**Then** each provider appends its respective bypass flag to CLI invocations (Claude: `--permission-mode bypassPermissions`, Copilot: `--yolo`, Qwen: `--yolo`)

### User switches provider with bypass enabled

**When** user has `speckit.permissionMode` set to `"bypass"` and switches from Claude to Copilot
**Then** the Copilot provider uses `--yolo` flag without any additional configuration

### Provider without bypass support

**When** user has `speckit.permissionMode` set to `"bypass"` and uses Gemini or Codex
**Then** the setting is silently ignored — no flag is appended

### Existing user with old per-provider setting

**When** an existing user upgrades and has `speckit.claudePermissionMode` set to `"bypassPermissions"`
**Then** the old setting is ignored (removed from schema), and the new `speckit.permissionMode` defaults to `"default"`

## Out of Scope

- Migration logic to auto-convert old settings to the new one
- Per-command permission mode overrides
- Additional permission modes beyond `"default"` and `"bypass"`
