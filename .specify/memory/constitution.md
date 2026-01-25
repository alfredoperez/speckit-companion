<!--
Sync Impact Report:
- Version change: 1.0.0 -> 1.1.0 (MINOR)
- List of modified principles:
  - UNCHANGED: I. Extensibility and Configuration
  - UNCHANGED: II. Spec-Driven Workflow
  - UNCHANGED: III. Visual and Interactive
  - NEW: IV. Modular Architecture for Complex Features
- Added sections:
  - Principle IV: Modular Architecture for Complex Features
- Removed sections: none
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (no changes needed - already supports structure docs)
  - ✅ .specify/templates/spec-template.md (no changes needed - story-based structure compatible)
  - ✅ .specify/templates/tasks-template.md (no changes needed - phase structure compatible)
- Follow-up TODOs: none
-->
# SpecKit Companion Constitution

## Core Principles

### I. Extensibility and Configuration
Every feature must be designed with extensibility in mind, particularly for supporting multiple AI providers. The extension architecture MUST allow for adding new providers without requiring a full rewrite. All provider-specific logic MUST be clearly separated and configurable. Configuration SHOULD be exposed to the user in a clear and accessible way.

### II. Spec-Driven Workflow
The extension MUST enforce and facilitate the spec-driven development workflow as defined by GitHub SpecKit. The core workflow of Spec -> Plan -> Tasks is non-negotiable. All features added to the extension MUST support or enhance this workflow.

### III. Visual and Interactive
The extension is a GUI tool and SHOULD prioritize a visual and interactive user experience. While it integrates with CLI tools, the primary interface for the user is within the VS Code UI. New features SHOULD have a visual component and be interactive, rather than just exposing CLI commands.

### IV. Modular Architecture for Complex Features
Complex features (particularly webview-based features) MUST adopt a modular file structure for maintainability. When a feature grows beyond 3-4 files or has distinct responsibilities (e.g., message handling, HTML generation, state management), it MUST be split into focused modules with clear separation of concerns.

**Required structure for large webview features:**
- **Extension side**: Separate modules for provider, message handlers, HTML generation, and utilities
- **Webview side**: Separate modules for entry point, rendering pipeline, state management, and UI interactions
- **CSS**: Use partial files with `@import` structure when styles exceed 200 lines

This pattern ensures features remain testable, navigable, and maintainable as complexity grows.

## AI Provider Integration

The extension MUST support multiple AI providers. Each provider is integrated via a dedicated `AIProvider` implementation that abstracts the specific CLI commands and file paths. When adding a new provider, a new implementation of the `AIProvider` interface must be created.

## User Interface

The user interface is built using VS Code's native UI components. The extension contributes several views to the "SpecKit" activity bar panel. New features should consider where they fit within this existing structure. The custom webview editor is reserved for the core spec-workflow documents.

## Governance

All pull requests and reviews must verify compliance with this constitution. Any deviation from these principles requires a formal amendment to this document. Amendments require documentation, approval, and a migration plan if they introduce breaking changes.

**Version**: 1.1.0 | **Ratified**: 2025-12-08 | **Last Amended**: 2026-01-18
