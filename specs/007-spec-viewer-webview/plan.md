# Implementation Plan: Unified Spec Viewer Webview Panel

**Branch**: `007-spec-viewer-webview` | **Date**: 2026-01-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-spec-viewer-webview/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Create a unified webview panel for viewing spec documents (spec.md, plan.md, tasks.md) with tabbed navigation, replacing the current approach of opening multiple editor tabs. The viewer will reuse a single panel instance, render markdown content with proper formatting, support VS Code theming, and provide edit actions to open documents in the standard editor.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode enabled)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`), Webpack 5
**Storage**: N/A (reads spec files directly from workspace filesystem)
**Testing**: Manual testing via Extension Development Host (F5)
**Target Platform**: VS Code 1.84.0+
**Project Type**: Single - VS Code Extension with webview
**Performance Goals**: <500ms document switch time (per SC-002), <2s content refresh after file save (per SC-005)
**Constraints**: Single viewer panel instance (per SC-003), WebviewPanel lifecycle management
**Scale/Scope**: Per-workspace spec viewing, typically <20 spec directories per workspace

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Extensibility and Configuration ✅ PASS
- **Assessment**: This feature adds a new viewer panel, does not affect AI provider integration
- **Compliance**: The viewer is a self-contained feature module following existing patterns (like spec-editor)
- **No provider-specific logic**: Document viewing is AI-agnostic

### II. Spec-Driven Workflow ✅ PASS
- **Assessment**: Feature directly supports the Spec → Plan → Tasks workflow
- **Compliance**: Provides visual navigation between spec, plan, and tasks documents
- **Enhancement**: Makes it easier to review workflow documents with tabbed navigation

### III. Visual and Interactive ✅ PASS
- **Assessment**: Feature is entirely visual - webview panel with rendered markdown and navigation
- **Compliance**: Primary interaction is within VS Code UI (webview panel, not CLI)
- **Interactive elements**: Tabbed navigation, edit action, file watcher for live updates

## Project Structure

### Documentation (this feature)

```text
specs/007-spec-viewer-webview/
├── spec.md              # Feature specification (input)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── features/
│   └── spec-viewer/            # NEW: Feature module for spec viewer
│       ├── index.ts            # Module exports
│       ├── types.ts            # Type definitions
│       ├── specViewerProvider.ts  # WebviewPanel provider
│       └── specViewerCommands.ts  # Command registration

webview/
├── src/
│   └── spec-viewer/            # NEW: Browser-side webview code
│       ├── index.ts            # Main webview entry point
│       └── types.ts            # Browser-side types
└── styles/
    └── spec-viewer.css         # NEW: Viewer-specific styles
```

**Structure Decision**: Follows existing spec-editor pattern with separate extension-side (`src/features/spec-viewer/`) and browser-side (`webview/src/spec-viewer/`) code. No contracts folder needed as this is a UI-only feature with no external APIs.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations - all constitution principles pass.

---

## Constitution Check (Post-Design Re-evaluation)

*GATE: Re-checked after Phase 1 design artifacts generated.*

### I. Extensibility and Configuration ✅ PASS (Confirmed)
- **Post-design assessment**: The design uses a self-contained feature module (`src/features/spec-viewer/`) that does not touch AI provider code
- **Message protocol**: Type-safe message passing between extension and webview - extensible for future features
- **No new dependencies**: Reuses existing custom markdown renderer and highlight.js from CDN

### II. Spec-Driven Workflow ✅ PASS (Confirmed)
- **Post-design assessment**: The SpecViewerState and SpecDocument types explicitly model spec/plan/tasks as core documents
- **Navigation design**: Tab-based navigation with core documents always first, reinforcing the workflow
- **Related documents**: Design includes support for additional markdown files (research.md, data-model.md) without breaking workflow hierarchy

### III. Visual and Interactive ✅ PASS (Confirmed)
- **Post-design assessment**: Webview panel with tabbed navigation, edit button, and rendered markdown
- **VS Code theming**: CSS variables map to VS Code theme tokens
- **Real-time updates**: File watcher design enables live content refresh

### Design Artifacts Summary

| Artifact | Status | Key Content |
|----------|--------|-------------|
| research.md | ✅ Complete | Markdown rendering, singleton pattern, file watchers |
| data-model.md | ✅ Complete | SpecViewerState, SpecDocument, message protocols |
| quickstart.md | ✅ Complete | 9-step implementation guide |

**Constitution Gate**: PASSED - Ready for task generation (`/speckit.tasks`).
