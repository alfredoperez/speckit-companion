# Spec: Remove CLI Path Override Settings

**Slug**: 127-remove-cli-path-settings | **Date**: 2026-06-05

## Summary

The extension exposes five per-CLI executable-path override settings (`speckit.claudePath`, `speckit.geminiPath`, `speckit.copilotPath`, `speckit.qwenPath`, `speckit.opencodePath`) plus a `speckit.geminiInitDelay` timing knob. These are rarely-needed power-user tuning options that clutter the configuration surface — and `claudePath` is already dead config (defined in `package.json` but never read, since the Claude provider declares `cliPathSettingKey = null`). This change removes the path overrides so every provider simply invokes its CLI by bare binary name from `PATH` (already the default fallback in `getCliPath()`), and removes the adjacent `geminiInitDelay` knob.

## Requirements

- **R001** (MUST): Remove the `speckit.claudePath`, `speckit.geminiPath`, `speckit.copilotPath`, `speckit.qwenPath`, and `speckit.opencodePath` configuration properties from `package.json` `contributes.configuration`.
- **R002** (MUST): Every CLI provider resolves its executable to the bare binary name (`claude`, `gemini`, `copilot`, `qwen`, `opencode`) — i.e. `cliPathSettingKey` becomes `null` for all providers and the per-provider `getCliPath` override in `geminiCliProvider.ts` is dropped in favor of the bare binary.
- **R003** (MUST): Remove the now-unused path keys (`claudePath`, `qwenPath`) from `ConfigKeys` in `src/core/constants.ts`, plus any other now-orphaned path key references.
- **R004** (SHOULD): Remove the `speckit.geminiInitDelay` setting and its `Timing.geminiInitDelay` default + read site, hard-coding the existing 8000ms default in the Gemini provider.
- **R005** (MUST): Extension activation and provider dispatch continue to work with no path settings present — no crash, no broken command, providers invoke their binary from `PATH`.
- **R006** (SHOULD): If any README/docs section documents these settings, remove it (current grep shows none documented, so this is likely a no-op).

## Scenarios

### Dispatching to a CLI provider after removal

**When** the user runs a spec step against any CLI provider (Gemini, Copilot, Qwen, OpenCode, Claude) with no path settings configured
**Then** the provider invokes its binary by bare name from `PATH`, exactly as it did when the path setting was left at its default

### Stale path setting persisted in user settings

**When** a user who previously set `speckit.geminiPath` upgrades to the version that removed it
**Then** the now-unknown setting is silently ignored by VS Code and dispatch falls back to the bare `gemini` binary — no activation error

### Gemini initialization delay

**When** the Gemini provider starts interactively and waits before sending the prompt
**Then** it uses the hard-coded 8000ms delay (the former default) with no configurable override

## Out of Scope

- Removing `speckit.commandFormat`, `speckit.permissionMode`, `speckit.claudePermissionMode`, or `speckit.qwenYoloMode` — these are behavioral, not path/tuning clutter, and are left untouched unless the user widens scope at the review gate.
- Any migration/notification telling users their path override was removed (VS Code's silent-ignore of unknown keys is sufficient).
- Changing how CLI installation is detected (`isInstalled()` already uses the bare binary).
