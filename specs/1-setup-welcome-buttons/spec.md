# Spec: Setup Welcome Buttons for Init & Constitution

**Slug**: 1-setup-welcome-buttons | **Date**: 2026-03-26

## Summary

The Specs tree view welcome content currently only shows "Create New Spec" regardless of workspace state. When SpecKit is not initialized or the constitution has placeholders, the welcome view should surface actionable buttons so users don't miss the setup steps. Image #13 confirms the init/constitution commands already work via Copilot — this just exposes them in the UI.

## Requirements

- **R001** (MUST): When SpecKit CLI is installed but workspace is NOT initialized (`!speckit.detected`), show an "Initialize Workspace" button in the Specs welcome view
- **R002** (MUST): When workspace IS initialized but constitution needs setup (`speckit.constitutionNeedsSetup`), show a "Configure Constitution" button in the Specs welcome view
- **R003** (MUST): When workspace is fully set up (initialized + constitution done), show the existing "Create New Spec" welcome content
- **R004** (SHOULD): Buttons should use VS Code codicon styling consistent with existing welcome buttons

## Scenarios

### Workspace not initialized

**When** SpecKit CLI is installed but `.specify/` directory does not exist
**Then** the Specs welcome view shows an "Initialize Workspace" button mapped to `speckit.initWorkspace`

### Constitution needs setup

**When** workspace is initialized but `constitution.md` has placeholder tokens
**Then** the Specs welcome view shows a "Configure Constitution" button mapped to `speckit.constitution`, plus the existing "Create New Spec" button

### Fully configured

**When** workspace is initialized and constitution has no placeholders
**Then** the Specs welcome view shows only "Create New Spec" (current behavior)

## Out of Scope

- Fixing the Copilot CLI prompt resolution issue (slash command → agent content)
- Changing the Steering welcome view
- Adding progress indicators or multi-step wizards
