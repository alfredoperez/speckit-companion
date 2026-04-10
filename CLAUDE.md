# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VSCode extension called "SpecKit Companion" that enhances AI CLI tools (Claude Code, Gemini CLI, GitHub Copilot CLI, Codex CLI, Qwen CLI) with structured spec-driven development features. The extension provides visual management of specs (requirements, design, tasks) and steering documents.

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
├── ai-providers/         # AI provider integrations (8 files)
├── core/                 # Core utilities and types
│   ├── constants, types, fileWatchers, specDirectoryResolver
│   ├── errors/
│   ├── managers/
│   ├── providers/
│   ├── types/
│   └── utils/
├── features/             # Business logic for features
│   ├── agents/
│   ├── permission/
│   ├── settings/
│   ├── skills/
│   ├── spec-editor/
│   ├── spec-viewer/
│   ├── specs/
│   ├── steering/
│   ├── workflow-editor/
│   └── workflows/
└── speckit/              # SpecKit CLI integration

webview/                  # Webview UI code (browser context)
├── src/                  # TypeScript source
│   ├── spec-viewer/      # Spec viewer webview
│   ├── spec-editor/      # Spec editor webview
│   ├── markdown/         # Shared markdown utilities
│   ├── render/           # Shared render utilities
│   ├── ui/               # Shared UI components
│   ├── types.ts          # Shared type definitions
│   └── workflow.ts       # Workflow editor
└── styles/               # CSS stylesheets
    ├── spec-viewer/      # Modular CSS partials (16 files + index.css)
    ├── spec-editor.css
    ├── spec-markdown.css
    ├── spec-viewer.css
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

## Documentation

When adding, changing, or removing a user-facing feature, update the README.md to reflect the change. Keep the README as the single source of truth for configuration options, workflow setup, and feature descriptions.

When modifying spec viewer statuses, badges, buttons, or step tab behavior, update `docs/viewer-states.md` to reflect the changes. This file documents the full state machine: status lifecycle, footer button matrix, badge text logic, step tab visual states, and data flow.

When modifying the project structure, adding/removing modules, or changing the architecture, update `docs/architecture.md` to reflect the changes.

## Important Notes

1. **File Operations**: Use `vscode.Uri` and workspace-relative paths
2. **Tree Updates**: Call `refresh()` on providers after data changes
3. **Webview Communication**: Use `postMessage()` for extension ↔ webview messaging
4. **CSS Variables**: Webviews use VS Code theme variables (e.g., `--vscode-editor-background`)
5. **Context Menus**: Defined in `package.json` under `contributes.menus`

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

- **BDD style**: Use `describe`/`it` blocks that describe behavior, not implementation
- **VS Code mock**: Extension-side tests use `tests/__mocks__/vscode.ts` (mapped via `jest.config.js` `moduleNameMapper`). Add mock APIs there as needed.
- **Config**: Jest uses `ts-jest` with `tsconfig.test.json`

## Tech Stack

- TypeScript 5.3+ (ES2022 target, strict mode)
- VS Code Extension API (`@types/vscode ^1.84.0`)
- Webpack 5 for bundling
- highlight.js (CDN) for syntax highlighting in webviews


## Active Technologies
- TypeScript 5.3+ (ES2022 target, strict mode) + VS Code Extension API (`@types/vscode ^1.84.0`) (044-context-driven-badges)
- `.spec-context.json` per spec directory (file-based) (044-context-driven-badges)
- TypeScript 5.3+ (ES2022 target, strict mode) + VS Code Extension API (`@types/vscode ^1.84.0`), Webpack 5 (045-update-docs)
- File-based (workspace `.claude/`, `specs/`, `.specify/` directories) (045-update-docs)
- File-based (`.spec-context.json` per spec directory) (049-fix-badge-status-display)
- File-based (workspace `.claude/specs/` directories) (049-fix-plan-indent)
- TypeScript 5.3+ (ES2022 target, strict mode) + VS Code Extension API (`@types/vscode ^1.84.0`), Preact (webview) (052-transition-logging)
- TypeScript 5.3+ (ES2022 target, strict mode) + VS Code Extension API, Preact (webview) (054-archive-button-left)
- N/A (rendering-only change) (055-fix-bullet-rendering)

## Recent Changes
- 044-context-driven-badges: Added TypeScript 5.3+ (ES2022 target, strict mode) + VS Code Extension API (`@types/vscode ^1.84.0`)
