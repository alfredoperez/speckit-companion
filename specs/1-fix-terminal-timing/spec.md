# Spec: Fix Terminal Timing and Extension Host Cleanup

**Slug**: 1-fix-terminal-timing | **Date**: 2026-03-31

## Summary

Fix two reliability issues: (1) investigate and resolve a "closing extension host" message that may appear when VS Code closes, and (2) fix a race condition where `sendText` fires before the terminal shell is ready, causing the CLI command to be lost. The terminal timing fix should use VS Code's shell integration API (already used in `executeHeadless`) instead of the current fixed 800ms `setTimeout` delay.

## Requirements

- **R001** (MUST): `executeInTerminal` and `executeSlashCommand` must wait for the terminal shell to be ready before calling `sendText`, instead of relying on a fixed 800ms delay
- **R002** (MUST): Use VS Code's `terminal.shellIntegration` API to detect shell readiness, with a timeout fallback for environments where shell integration is unavailable
- **R003** (MUST): Audit the `deactivate()` function and all disposables to ensure the extension cleans up properly without triggering "closing extension host" warnings
- **R004** (SHOULD): Apply the same shell-readiness pattern consistently across all AI providers (Claude, Gemini, Copilot, Codex, Qwen)
- **R005** (SHOULD): Remove the hardcoded `terminalVenvActivationDelay` constant and `getTerminalDelay()` config method once replaced by shell integration

## Scenarios

### Terminal command sent before shell ready

**When** the extension creates a new terminal and sends a CLI command
**Then** it waits for `terminal.shellIntegration` to become available (or a timeout fallback) before calling `sendText`, ensuring the command is not lost

### Shell integration unavailable

**When** the terminal's shell integration does not activate within the timeout period
**Then** the extension falls back to `sendText` after the timeout, matching the current fallback behavior in `executeHeadless`

### VS Code window closes with extension active

**When** the user closes VS Code while the extension is active
**Then** the extension disposes all resources cleanly without triggering "closing extension host" messages

### Multiple terminals opened rapidly

**When** the user triggers multiple terminal commands in quick succession
**Then** each terminal independently waits for its own shell readiness without interfering with others

## Non-Functional Requirements

- **NFR001** (MUST): Terminal commands must begin executing within 5 seconds of terminal creation, even when shell integration is unavailable (fallback timeout)

## Out of Scope

- Making the terminal delay user-configurable via settings (shell integration replaces the need)
- Changing headless execution behavior (already uses shell integration correctly)
