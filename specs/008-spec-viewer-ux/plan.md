# Implementation Plan: Spec Viewer UX Polish

**Branch**: `008-spec-viewer-ux` | **Date**: 2026-01-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-spec-viewer-ux/spec.md`

## Summary

Improve visual consistency, spacing, and interaction behaviors in the spec viewer webview. This feature focuses on CSS adjustments to reduce visual clutter (excessive dividers, padding), typography hierarchy refinements, comment interaction improvements, and state-aware UI controls that hide editing options for completed specs. The approach is primarily CSS-driven with targeted TypeScript changes for behavior modifications.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`), Webpack 5, highlight.js (CDN)
**Storage**: N/A (reads spec files directly from workspace filesystem)
**Testing**: Jest 29 with ts-jest (unit tests available but manual testing primary for UI)
**Target Platform**: VS Code ^1.84.0 (Windows, macOS, Linux)
**Project Type**: VS Code Extension with WebviewPanel (hybrid: Node.js extension + browser webview)
**Performance Goals**: Responsive UI transitions (<150ms), no visible flicker on document switching
**Constraints**: Must use VS Code theme variables for all colors, CSP-compliant webview
**Scale/Scope**: Single webview feature affecting ~16 CSS partials and ~5 TypeScript modules

### Existing Architecture

**Extension side** (`src/features/spec-viewer/`):
- `specViewerProvider.ts` - Main provider managing WebviewPanel lifecycle
- `messageHandlers.ts` - Routes 12 message types from webview
- `types.ts` - Type definitions including document status
- `html/generator.ts` - HTML generation with CSP and theming

**Webview side** (`webview/src/spec-viewer/`):
- `markdown/renderer.ts` - Line wrapping with `wrapWithLineActions()`
- `markdown/scenarios.ts` - Acceptance scenario table rendering (to be converted to list)
- `editor/inlineEditor.ts` - Inline editor for comments
- `editor/refinements.ts` - Refinement state management
- `editor/lineActions.ts` - Quick action buttons per line type

**CSS partials** (`webview/styles/spec-viewer/`):
- `_variables.css` - 120+ CSS custom properties
- `_typography.css` - Heading sizes and spacing
- `_line-actions.css` - Line hover effects and "+" button
- `_editor.css` - Inline editor with divider styling
- `_refinements.css` - Comment card styling
- `_tables.css` - Acceptance scenario table (165+ lines)
- `_content.css` - General content styling
- `_footer.css` - Footer CTA buttons

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Extensibility and Configuration** | ✅ PASS | No provider-specific changes; CSS variables maintain theming flexibility |
| **II. Spec-Driven Workflow** | ✅ PASS | Enhances the spec review workflow with better visual hierarchy |
| **III. Visual and Interactive** | ✅ PASS | Core focus is improving GUI user experience |
| **IV. Modular Architecture** | ✅ PASS | Changes follow existing modular CSS partial structure |

**Gate Result**: All principles satisfied. No violations require justification.

## Project Structure

### Documentation (this feature)

```text
specs/008-spec-viewer-ux/
├── plan.md              # This file
├── research.md          # Phase 0 output - UX patterns research
├── data-model.md        # Phase 1 output - State model for spec status
├── quickstart.md        # Phase 1 output - Implementation guide
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (files to modify)

```text
# Extension side (minimal changes)
src/features/spec-viewer/
├── specViewerProvider.ts    # Add spec status to webview state
├── types.ts                 # Add SpecStatus type if needed
└── html/generator.ts        # Pass status to webview

# Webview side (behavior changes)
webview/src/spec-viewer/
├── index.ts                 # Handle status-based UI state
├── markdown/
│   ├── renderer.ts          # Adjust line wrapping for button position
│   └── scenarios.ts         # Convert table to list format
├── editor/
│   ├── inlineEditor.ts      # Fix button visibility, quick actions
│   ├── refinements.ts       # Hide controls when completed
│   └── lineActions.ts       # "Remove" → "Remove Line", add comment on click

# CSS partials (primary changes)
webview/styles/spec-viewer/
├── _variables.css           # Adjust spacing variables if needed
├── _typography.css          # H2/H3 margin and font-size adjustments
├── _content.css             # Reduce list padding, remove double dividers
├── _line-actions.css        # Button position top-left, hide when editor open
├── _editor.css              # Remove divider, full-width panel
├── _refinements.css         # Styling adjustments
├── _tables.css              # Scenario list styling (replaces table)
├── _callouts.css            # Input section border styling
└── _footer.css              # Hide CTAs when completed
```

**Structure Decision**: This is a UI polish feature modifying existing files. No new modules required. Changes follow the existing modular CSS partial pattern established in 007-spec-viewer-webview.

## Complexity Tracking

> No violations. All changes align with existing architecture.

## Post-Design Constitution Re-Check

*Re-evaluation after Phase 1 design completion*

| Principle | Status | Design Impact |
|-----------|--------|---------------|
| **I. Extensibility** | ✅ PASS | SpecStatus type is extensible for future states; CSS-based hiding doesn't couple to specific implementations |
| **II. Spec-Driven Workflow** | ✅ PASS | Status detection enables workflow-aware UI (hiding controls when spec complete) |
| **III. Visual and Interactive** | ✅ PASS | All changes improve visual quality and interaction patterns |
| **IV. Modular Architecture** | ✅ PASS | Changes distributed across existing modular CSS partials; no monolithic files created |

**Final Gate Result**: All principles satisfied. Implementation may proceed to task generation.

---

## Generated Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Plan | `/specs/008-spec-viewer-ux/plan.md` | This file |
| Research | `/specs/008-spec-viewer-ux/research.md` | Resolved all NEEDS CLARIFICATION items |
| Data Model | `/specs/008-spec-viewer-ux/data-model.md` | SpecStatus type, CSS variables, HTML structure |
| Quickstart | `/specs/008-spec-viewer-ux/quickstart.md` | Step-by-step implementation guide |
| Contracts | `/specs/008-spec-viewer-ux/contracts/webview-messages.md` | Message protocol (minimal changes) |

---

## Next Steps

Run `/speckit.tasks` to generate the implementation task list based on this plan.
