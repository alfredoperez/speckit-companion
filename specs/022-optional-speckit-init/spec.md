# Spec: Optional SpecKit Initialization

**Branch**: 022-optional-speckit-init | **Date**: 2026-03-26

## Summary

The extension currently requires SpecKit CLI initialization (`.specify/` directory or `.github/agents/speckit.*.md` files) before users can create specs or use core features. This creates a hard dependency on GitHub SpecKit. The extension should work standalone — treating SpecKit as a first-class integration but not a prerequisite. Users should be able to create and manage specs using only the extension's built-in spec directory support (configurable via `speckit.specDirectories`), with constitution and CLI init remaining available but optional.

## Requirements

- **R001** (MUST): The `speckit.create` command must work without SpecKit workspace initialization — it should open the spec editor regardless of whether `.specify/` exists or SpecKit CLI is installed.
- **R002** (MUST): The `SpecKitDetector.createSpec()` method must not gate on `_isInitialized`; remove or bypass the initialization check that blocks spec creation.
- **R003** (MUST): The extension must activate all core views (spec explorer, steering explorer) even when SpecKit is not detected — `speckit.detected` context should not hide spec-related UI.
- **R004** (SHOULD): The init suggestion popup (shown when CLI is installed but workspace not initialized) should be non-blocking and dismissable, not prevent feature usage.
- **R005** (SHOULD): Constitution-related features (setup suggestion, constitution tree node) should degrade gracefully — show the node only when the file exists, never require it.
- **R006** (MUST): When SpecKit is not initialized, specs should be read from/written to the configured `speckit.specDirectories` paths (defaulting to `.claude/specs`).
- **R007** (SHOULD): SpecKit CLI commands (init, upgrade) remain available in the command palette and steering view for users who want the full SpecKit integration.

## Scenarios

### Creating a spec without SpecKit

**When** a user opens a workspace without `.specify/` or SpecKit CLI and runs `speckit.create`
**Then** the spec editor opens normally, and the spec is saved to the first configured spec directory (e.g., `.claude/specs/{spec-name}/`)

### Extension activation without SpecKit

**When** the extension activates in a workspace without SpecKit
**Then** the spec explorer and steering explorer load normally, showing any specs found in configured spec directories; no error or blocking prompt is shown

### SpecKit is available

**When** SpecKit CLI is installed and workspace is initialized
**Then** the extension behaves as today — constitution node appears in steering, SpecKit files are shown, CLI commands are available

### Constitution file absent

**When** no constitution file exists at `.specify/memory/constitution.md`
**Then** no constitution setup suggestion is shown, and the constitution tree node is hidden — no errors or warnings

## Out of Scope

- Removing SpecKit CLI integration entirely — it remains a supported (optional) enhancement
- Changing the spec file format or directory structure
- Auto-migrating existing `.specify/` specs to the new default directory
- Modifying the AI provider selection flow
