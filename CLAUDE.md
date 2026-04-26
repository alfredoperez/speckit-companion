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

When adding, changing, or removing a user-facing feature, update README.md.
The README is the single source of truth for configuration, workflows, and
features. Use the map below to find the right section.

When modifying spec viewer statuses, badges, buttons, or step tab behavior,
also update `docs/viewer-states.md` (full state machine: status lifecycle,
footer button matrix, badge text logic, step tab visual states, data flow).

When modifying the project structure, adding/removing modules, or changing
the architecture, also update `docs/architecture.md`.

When modifying the sidebar (filter, sort, lifecycle buttons, badge tiers,
tree icons, transition logging), also update `docs/sidebar.md` (the long-form
sidebar reference linked from the README).

### Feature → README section map

| Change you made | README section to update |
|-----------------|--------------------------|
| New AI provider | "Supported AI Providers" matrix (add column) + provider count anywhere it's stated (e.g. "Six providers ship today" in "Why it exists") + `package.json` `contributes.configuration["speckit.aiProvider"].enum` must match |
| New canonical workflow status | "Header badge color tiers" in `docs/sidebar.md` + "Status vocabulary" under Spec Context in README |
| New configuration setting | "Configuration" section in README (add subsection with JSON example + value table) |
| New sidebar action / right-click menu item | `docs/sidebar.md` (full reference) + the lean "Sidebar at a Glance" summary in README |
| New keyboard or visual safety affordance | "Safety Affordances for Destructive Actions" in README |
| New workflow phase or sub-document type | "Spec-Driven Phases" in README + Step Properties table under Custom Workflows |
| New custom command type | "Custom Commands" properties table in README |
| New platform support / shell support | "Platform Support" table in README |
| New webview UI element (header, badge, tab, etc.) | "Reading Specs" subsection in README + retake associated screenshot |
| Bug fix that changes documented behavior | The README section that documented the broken behavior |

### Per-release checklist (run before tagging a version)

1. Run `git diff $(git describe --tags --abbrev=0)..HEAD -- README.md` to see what was already updated since the last tag.
2. Cross-check `CHANGELOG.md` entries since the last release against the map above.
3. For every CHANGELOG bullet under "New Features," confirm a README section was touched. If not, add one.
4. Update the "Recently Shipped" block at the top of README with the current and previous two releases.
5. Verify `package.json` `contributes.configuration["speckit.aiProvider"].enum` matches the README provider matrix (count + names).
6. Verify `package.json` `engines.vscode` matches the README "VS Code" badge.
7. Re-render any screenshot whose UI changed in this release and refresh its caption if the value prop shifted.

When in doubt, look at how an existing feature is documented and follow the
same pattern.

## Extension Isolation (critical)

The installed SpecKit Companion extension ships ONLY what is packaged into
the `.vsix` (code under `src/`, bundled webview, assets). It does NOT ship:

- `.claude/skills/**` — dev-workspace skills; users don't have them.
- `.specify/templates/**`, `.specify/extensions.yml`, `.specify/scripts/**`
  — these belong to the SpecKit CLI / user's own workspace.
- `.claude/**` in general — user-local AI setup.

Any runtime behavior the extension needs must work without any of those
files. Treat them as read-only from the extension's perspective.

Correct surfaces for extension-owned behavior:

1. **Extension command handlers** (`src/features/specs/specCommands.ts`,
   viewer message handlers) — direct writes via `specContextWriter`.
2. **Prompt text the extension builds** for the AI CLI (in
   `ai-providers/*` / `executeInTerminal(prompt)`) — prepend/append
   instructions here; this text is assembled at runtime by shipped code.

Do NOT modify `.claude/**` or `.specify/**` to implement extension
features. If the feature needs the AI to do something, have the extension
embed the instruction in the prompt it dispatches.

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
- TypeScript 5.3+ (ES2022, strict) + VS Code Extension API (`@types/vscode ^1.84.0`), Preact (webview) (060-spec-context-tracking)
- File-based — `.spec-context.json` per spec dir under workspace `.claude/specs/` (060-spec-context-tracking)
- N/A (filesystem reveal only; no persisted state) (069-reveal-spec-folder)

## Recent Changes
- 044-context-driven-badges: Added TypeScript 5.3+ (ES2022 target, strict mode) + VS Code Extension API (`@types/vscode ^1.84.0`)
