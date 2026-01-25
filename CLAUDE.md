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

```
src/                      # Main extension source (Node.js)
├── extension.ts          # Extension entry point, command registration
├── core/                 # Core utilities and types
├── features/             # Business logic for features
├── ai-providers/         # AI provider integrations
├── speckit/              # SpecKit CLI integration
└── utils/                # Utility functions

webview/                  # Webview UI code (browser context)
├── src/                  # TypeScript source
│   ├── spec-viewer/      # Spec viewer webview
│   ├── spec-editor/      # Spec editor webview
│   └── workflow.ts       # Workflow editor
└── styles/               # CSS stylesheets
    ├── spec-viewer/      # Modular CSS partials
    ├── spec-editor.css
    └── workflow.css

assets/                   # Static assets (icons, media)
```

### Key Patterns

- **Manager Pattern**: Each feature has a Manager class handling file operations and business logic
- **Provider Pattern**: Tree views use Provider classes extending `vscode.TreeDataProvider`
- **Webview Pattern**: Complex UIs use WebviewPanel with message passing between extension and webview
- **Command Registration**: Commands registered in `activate()` with pattern `speckit.{feature}.{action}`

### Modular Webview Structure

The spec-viewer uses a modular architecture:

**Extension side** (`src/features/spec-viewer/`):
- `specViewerProvider.ts` - Main WebviewPanel provider
- `messageHandlers.ts` - Webview message routing
- `html/` - HTML generation modules

**Webview side** (`webview/src/spec-viewer/`):
- `markdown/` - Rendering pipeline (renderer, preprocessors, scenarios)
- `editor/` - Inline editing (inlineEditor, refinements, lineActions)

**CSS** (`webview/styles/spec-viewer/`):
- Modular partials imported via `index.css`

### Data Storage

User data stored in workspace `.claude/` directory:

```
.claude/
├── specs/{spec-name}/
│   ├── spec.md
│   ├── plan.md
│   └── tasks.md
└── steering/*.md
```

## Important Notes

1. **File Operations**: Use `vscode.Uri` and workspace-relative paths
2. **Tree Updates**: Call `refresh()` on providers after data changes
3. **Webview Communication**: Use `postMessage()` for extension ↔ webview messaging
4. **CSS Variables**: Webviews use VS Code theme variables (e.g., `--vscode-editor-background`)
5. **Context Menus**: Defined in `package.json` under `contributes.menus`

## Tech Stack

- TypeScript 5.3+ (ES2022 target, strict mode)
- VS Code Extension API (`@types/vscode ^1.84.0`)
- Webpack 5 for bundling
- highlight.js (CDN) for syntax highlighting in webviews
