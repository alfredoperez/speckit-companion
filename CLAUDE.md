# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VSCode extension called "SpecKit Companion" that enhances AI CLI tools (Claude Code, Gemini CLI, GitHub Copilot CLI) with structured spec-driven development features. The extension provides visual management of specs (requirements, design, tasks) and steering documents.

## Development Commands

```bash
# Install dependencies
npm install

# Compile TypeScript (one-time)
npm run compile

# Watch mode for development (auto-compile on changes)
npm run watch

# Package the extension into .vsix file
npm run package

# Run in VSCode
# Press F5 in VSCode to launch Extension Development Host
```

## Architecture

### Project Structure

```plain
src/                      # Main extension source (Node.js)
├── extension.ts          # Extension entry point, command registration
├── core/                 # Core utilities and types
├── features/             # Business logic for features
├── ai-providers/         # AI provider integrations
├── speckit/              # SpecKit CLI integration
└── utils/                # Utility functions

webview/                  # Workflow editor webview
├── src/                  # TypeScript source (browser)
└── styles/               # CSS stylesheets

assets/                   # Static assets
├── icons/                # Extension icons (SVG)
└── media/                # Media files (images, HTML)

docs/                     # Documentation assets
└── screenshots/          # README screenshots
```

### Core Components

1. **Extension Entry** (`src/extension.ts`): Registers all commands and initializes providers
2. **Feature Managers** (`src/features/`): Business logic for specs and steering documents
3. **Providers** (`src/providers/`): VSCode TreeDataProviders for UI views
4. **Prompts** (`src/prompts/`): AI prompt templates for spec generation

### Key Patterns

- **Manager Pattern**: Each feature has a Manager class that handles file operations and business logic
- **Provider Pattern**: Each tree view has a Provider class extending `vscode.TreeDataProvider`
- **Command Registration**: All commands are registered in `activate()` with pattern `kfc.{feature}.{action}`

### Modular Webview Pattern (spec-viewer)

Large webview features use a modular structure for maintainability:

**Extension side** (`src/features/spec-viewer/`):
- `specViewerProvider.ts` - Main provider class
- `messageHandlers.ts` - Webview message routing
- `documentScanner.ts` - File discovery
- `phaseCalculation.ts` - Workflow phase logic
- `html/` - HTML generation modules
- `utils.ts`, `types.ts` - Shared utilities

**Webview side** (`webview/src/spec-viewer/`):
- `index.ts` - Entry point, initialization
- `markdown/` - Rendering pipeline (renderer, preprocessors, scenarios)
- `editor/` - Inline editing (inlineEditor, refinements, lineActions)
- `navigation.ts`, `highlighting.ts`, `modal.ts`, `actions.ts`

**CSS partials** (`webview/styles/spec-viewer/`):
- `index.css` imports 15 partials (_variables, _base, _navigation, etc.)
- Webpack CopyPlugin copies partials to dist for @import resolution

### Data Structure

User data is stored in workspace `.claude/` directory:

```plain
.claude/
├── specs/{spec-name}/
│   ├── requirements.md
│   ├── design.md
│   └── tasks.md
├── steering/*.md
└── settings/kfc-settings.json
```

## Spec Workflow Implementation

The spec workflow follows these states:

1. Requirements → Review → Design
2. Design → Review → Tasks
3. Tasks → Review → Complete

Each transition requires explicit user approval. The workflow is implemented in `specPrompts.ts` and enforced by the spec agent system prompt.

## Claude Code Integration

The extension integrates with Claude CLI through the `ClaudeCodeProvider`:

- Sends commands via VS Code terminal
- Uses temporary files for long prompts
- Supports system prompts for context injection
- Terminal commands are built with format: `claude [options] < promptFile`

## Testing & Debugging

Currently, the claudeCodeProvider has a test echo command at line 62:

```typescript
let command = `echo "HELLO WORLD"`;
```

This should be replaced with actual Claude CLI integration when testing is complete.

## Important Implementation Notes

1. **File Operations**: Always use `vscode.Uri` and workspace-relative paths
2. **Tree Updates**: Call `refresh()` on providers after any data changes
3. **Error Handling**: All file operations should have try-catch blocks
4. **User Prompts**: Use `vscode.window.showInputBox()` for user input
5. **Context Menus**: Defined in `package.json` under `contributes.menus`

## Extension Points

- **New Managers**: Add to `src/features/` following existing patterns
- **New Providers**: Add to `src/providers/` extending `TreeDataProvider`
- **New Commands**: Register in `extension.ts` and add to `package.json`
- **New Prompts**: Add to `src/prompts/` for AI-assisted features

## Recent Changes
- 007-spec-viewer-webview: Implemented Unified Spec Viewer Webview Panel
  - **Core Feature**: Read-only webview panel for viewing spec documents (spec.md, plan.md, tasks.md) with tabbed navigation
  - **Files Created** (modular architecture):
    - `src/features/spec-viewer/` - 12 modules (provider, handlers, html/, utils)
    - `webview/src/spec-viewer/` - 17 modules (markdown/, editor/, navigation)
    - `webview/styles/spec-viewer/` - 16 CSS partials with @import structure
  - **Key Components**:
    - `SpecViewerProvider`: Singleton WebviewPanel with document switching and live refresh
    - Document scanning for core (spec/plan/tasks) and related documents
    - Full markdown rendering with syntax highlighting via highlight.js CDN
  - **User Stories Implemented**:
    - US1: View Spec Document in unified panel (singleton pattern)
    - US2: Tab navigation between spec/plan/tasks and related documents
    - US3: Rendered markdown with syntax highlighting
    - US4: Edit button opens document in VS Code editor (ViewColumn.Beside)
    - US5: Panel persistence, focus management, and live file watcher updates (500ms debounce)
  - **Integration**: Command `speckit.viewSpecDocument`, file watcher in `src/core/fileWatchers.ts`
  - **Tech**: VS Code theme variables, high-contrast mode support, CSP with CDN allowlist
- 005-speckit-views-enhancement: Enhanced SpecKit views with contextual initialization and file visibility
  - **US1**: Fixed contextual initialization message - now only shows when a valid workspace is open
    - Added workspace check before showing init suggestion in `src/extension.ts:50-55`
  - **US2**: Added SpecKit Files section to steering view
    - New types in `src/features/steering/types.ts`: SpecKitFileType, SpecKitFile, SpecKitFilesResult, SPECKIT_CONTEXT_VALUES, SPECKIT_ICONS, SPECKIT_PATHS
    - Scans `.specify/` directory for constitution, scripts, and templates
    - Files are clickable and open in the editor
    - Modified: `src/features/steering/steeringExplorerProvider.ts`
  - **US3**: Organized SpecKit files into collapsible categories
    - Constitution, Scripts, Templates categories with appropriate icons
    - File watcher for `.specify/` directory with debounced refresh (1s)
    - Modified: `src/core/fileWatchers.ts`
- 006-plan-step-highlight: Added TypeScript 5.3+ (ES2022 target, strict mode enabled) + VS Code Extension API (`@types/vscode ^1.84.0`), Webpack 5
- 004-spec-editor-webview: Implemented Spec Editor Webview feature
  - **Core Feature**: Rich webview-based spec editor with multi-line text input, image attachments, and AI CLI submission
  - **Files Created**:
    - `src/features/spec-editor/` - Feature module (types, provider, commands, managers)
    - `webview/src/spec-editor/` - Browser-side webview code
    - `webview/styles/spec-editor.css` - Themed styles
  - **Key Components**:
    - `SpecEditorProvider`: WebviewPanel-based editor with submit/preview/cancel
    - `TempFileManager`: Manifest-based temp file management with cleanup
    - `SpecDraftManager`: Draft persistence via workspaceState
  - **User Stories Implemented**:
    - US1: Multi-line text editor with keyboard shortcuts (Ctrl+Enter, Esc)
    - US2: Image attachments via file picker or drag-drop (2MB/10MB limits)
    - US3: Automatic temp file management with cleanup
    - US4: Load previous spec as template
  - **Integration**: Command `speckit.openSpecEditor` with keybinding Ctrl+Shift+N
  - All hardcoded colors replaced with CSS custom properties mapped to VS Code theme variables
  - Theme-specific fallbacks for light, dark, and high-contrast modes
  - Typography uses VS Code font settings (--vscode-font-family, --vscode-editor-font-family)
  - Compact layout with reduced header margins (~30% vertical space reduction)
  - Empty lines have no hover effects (pointer-events: none)
  - Files modified: `webview/styles/workflow.css`
  - CSS `field-sizing: content` with hidden span fallback for older browsers
  - Original value displayed above input with visual distinction (italic, muted, accent border)
  - Files modified: `webview/styles/workflow.css`, `webview/src/ui/refinePopover.ts`

## Active Technologies
- N/A (reads spec files directly from workspace filesystem) (007-spec-viewer-webview)
