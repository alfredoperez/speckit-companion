<!--
Sync Impact Report:
- Version change: 1.1.0 -> 1.2.0 (MINOR)
- List of modified principles:
  - UPDATED: I. Extensibility and Configuration (added custom workflow guidance)
  - UPDATED: II. Spec-Driven Workflow (removed "GitHub SpecKit" reference,
    added lifecycle and custom workflow awareness)
  - UNCHANGED: III. Visual and Interactive
  - UNCHANGED: IV. Modular Architecture for Complex Features
- Added sections: none
- Removed sections: none
- Updated sections:
  - AI Provider Integration (minor wording, no structural change)
  - User Interface (added spec lifecycle description)
- Templates requiring updates:
  - .specify/templates/plan-template.md (no changes needed -
    Constitution Check section already generic)
  - .specify/templates/spec-template.md (no changes needed -
    story-based structure compatible)
  - .specify/templates/tasks-template.md (no changes needed -
    phase structure compatible)
  - .specify/templates/checklist-template.md (no changes needed)
  - .specify/templates/agent-file-template.md (no changes needed)
- Follow-up TODOs: none
-->
# SpecKit Companion Constitution

## Core Principles

### I. Extensibility and Configuration

Every feature MUST be designed with extensibility in mind. The extension
architecture MUST allow adding new AI providers without requiring a full
rewrite. All provider-specific logic MUST be clearly separated and
configurable. Configuration SHOULD be exposed to the user in a clear and
accessible way.

The extension MUST support user-defined custom workflows and custom
commands. Default behaviors MUST be overridable through VS Code settings
so that teams can adapt the tool to their own SDD methodology without
forking.

### II. Spec-Driven Workflow

The extension MUST enforce and facilitate a spec-driven development
workflow. The core pipeline of **Specify -> Plan -> Tasks -> Implement**
is non-negotiable. All features added to the extension MUST support or
enhance this pipeline.

Specs MUST follow a managed lifecycle: **Active -> Completed -> Archived**.
Status transitions MUST be explicit user actions (not inferred from
heuristics alone). The sidebar, viewer, and any automation MUST respect
the current lifecycle state when presenting options to the user.

Custom workflows MAY redefine step names, labels, commands, and output
files, but MUST preserve the sequential-phase model where each step
produces or consumes a markdown artifact.

### III. Visual and Interactive

The extension is a GUI tool and MUST prioritize a visual and interactive
user experience. While it integrates with CLI tools, the primary
interface for the user is within the VS Code UI. New features SHOULD
have a visual component and be interactive rather than just exposing CLI
commands.

### IV. Modular Architecture for Complex Features

Complex features (particularly webview-based features) MUST adopt a
modular file structure for maintainability. When a feature grows beyond
3-4 files or has distinct responsibilities (e.g., message handling, HTML
generation, state management), it MUST be split into focused modules
with clear separation of concerns.

**Required structure for large webview features:**
- **Extension side**: Separate modules for provider, message handlers,
  HTML generation, and utilities
- **Webview side**: Separate modules for entry point, rendering pipeline,
  state management, and UI interactions
- **CSS**: Use partial files with `@import` structure when styles exceed
  200 lines

This pattern ensures features remain testable, navigable, and
maintainable as complexity grows.

## AI Provider Integration

The extension MUST support multiple AI providers. Each provider is
integrated via a dedicated `AIProvider` implementation that abstracts the
specific CLI commands and file paths. When adding a new provider, a new
implementation of the `AIProvider` interface MUST be created. Shared
logic across providers MUST be extracted into common utilities to avoid
duplication.

## User Interface

The user interface is built using VS Code's native UI components. The
extension contributes several views to the "SpecKit" activity bar panel.
New features SHOULD consider where they fit within this existing
structure. The custom webview editor is reserved for the core
spec-workflow documents.

The sidebar organizes specs into lifecycle groups (Active, Completed,
Archived) with color-coded indicators. Features that surface spec state
MUST use the canonical lifecycle grouping and status badges defined in
the viewer-states documentation.

## Governance

All pull requests and reviews MUST verify compliance with this
constitution. Any deviation from these principles requires a formal
amendment to this document. Amendments require documentation, approval,
and a migration plan if they introduce breaking changes.

Constitution versioning follows semantic versioning:
- **MAJOR**: Backward-incompatible principle removals or redefinitions
- **MINOR**: New principle/section added or materially expanded guidance
- **PATCH**: Clarifications, wording, or typo fixes

**Version**: 1.2.0 | **Ratified**: 2025-12-08 | **Last Amended**: 2026-04-05
