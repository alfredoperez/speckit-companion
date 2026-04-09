# Spec: Command Format Setting

**Slug**: 053-command-format-setting | **Date**: 2026-04-09

## Summary

Add a `speckit.commandFormat` VS Code setting that lets users override how speckit commands are formatted (dot vs dash notation) when sent to AI CLI tools. Currently the format is hardcoded per provider in `PROVIDER_PATHS`; users on mismatched spec-kit versions need a manual override.

## Requirements

- **R001** (MUST): Register a `speckit.commandFormat` setting in `package.json` with enum values `auto`, `dot`, `dash` (default: `auto`)
- **R002** (MUST): When set to `dot`, `formatCommandForProvider()` must always return dot notation (`speckit.plan`) regardless of provider
- **R003** (MUST): When set to `dash`, `formatCommandForProvider()` must always return dash notation (`speckit-plan`) regardless of provider
- **R004** (MUST): When set to `auto`, preserve existing provider-based logic from `PROVIDER_PATHS.commandFormat`
- **R005** (SHOULD): Setting description should explain the dot/dash difference and when users might need to override

## Scenarios

### User overrides to dash notation

**When** user sets `speckit.commandFormat` to `dash` and uses Gemini (which defaults to dot)
**Then** all commands are formatted as `speckit-plan`, `speckit-specify`, etc.

### User overrides to dot notation

**When** user sets `speckit.commandFormat` to `dot` and uses Claude (which defaults to dash)
**Then** all commands are formatted as `speckit.plan`, `speckit.specify`, etc.

### Auto mode preserves existing behavior

**When** `speckit.commandFormat` is `auto` (default)
**Then** Claude/Codex use dash, Gemini/Copilot/Qwen use dot — same as current behavior

## Out of Scope

- Changing the default format for any provider in `PROVIDER_PATHS`
- Per-provider command format overrides (only a single global override)
- Migration or deprecation of the `commandFormat` field in `ProviderPaths`
