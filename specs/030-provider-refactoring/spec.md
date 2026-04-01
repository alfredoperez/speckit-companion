# Spec: Provider Refactoring — Reduce Duplication

**Slug**: 030-provider-refactoring | **Date**: 2026-04-01

## Summary

Extract duplicated code across the 5 AI provider implementations (Claude, Gemini, Copilot, Codex, Qwen) into shared utility functions. The `executeHeadless` shell integration pattern (~243 lines), `createTempFile` method (~45 lines), and `executeInTerminal` pattern (~80 lines) are near-identical across providers, differing only in log prefixes and minor cleanup logic. This refactoring reduces ~300+ lines while keeping providers extensible for future additions.

## Requirements

- **R001** (MUST): Extract `executeCommandInHiddenTerminal()` into `terminalUtils.ts` to replace the duplicated `executeHeadless` shell integration pattern across all 5 providers
- **R002** (MUST): Extract `createTempFile()` into `core/utils/tempFileUtils.ts` with an optional `convertWSL` flag, replacing the identical method in all 5 providers
- **R003** (MUST): Each provider's `executeHeadless` must reduce to a thin wrapper (~5 lines) calling the shared utility
- **R004** (MUST): Preserve all existing behavior — shell integration path, fallback path, exit code reporting, temp file cleanup, and per-provider logging
- **R005** (SHOULD): Extract `ensureInstalled` boilerplate into a shared utility that accepts CLI name and install command
- **R006** (SHOULD): Evaluate and optionally extract `executeInTerminal` into a `createAndSendToTerminal(options)` helper for the 4 providers that share the pattern (exclude Gemini)
- **R007** (MUST): Composition over inheritance — use utility functions, not an abstract base class

## Scenarios

### Headless execution with shell integration

**When** a provider executes a prompt in headless mode and shell integration is available
**Then** the shared `executeCommandInHiddenTerminal` creates a hidden terminal, executes via `shellIntegration.executeCommand`, listens for completion, cleans up the temp file, and returns the exit code

### Headless execution fallback

**When** shell integration is not available
**Then** the shared utility falls back to `sendText`, resolves after timeout, disposes the terminal, and cleans up the temp file

### Provider-specific cleanup

**When** a provider has custom cleanup logic (e.g., Codex conditional `tempFilePath` cleanup)
**Then** the shared utility accepts an optional `cleanupFn` callback that runs after execution completes

### Temp file creation with WSL path conversion

**When** a provider on WSL creates a temp file
**Then** `createTempFile` in `tempFileUtils.ts` applies `convertPathIfWSL()` when the `convertWSL` option is true (Claude, Codex, Qwen) and skips conversion otherwise (Gemini, Copilot)

### Adding a new provider

**When** a developer adds a new AI provider
**Then** they implement `IAIProvider` using the shared utilities, writing only provider-specific logic (CLI command, flags, log prefix)

## Out of Scope

- Changing the `IAIProvider` interface
- Introducing an abstract base class or provider inheritance hierarchy
- Modifying Gemini's unique interactive mode / init delay behavior
- Changing the `PROVIDER_PATHS` configuration structure
- Adding new provider features or capabilities
