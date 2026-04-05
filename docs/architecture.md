# Architecture

## Overview

SpecKit Companion is a VS Code extension that provides a visual interface for spec-driven development with Claude Code and GitHub SpecKit.

## Directory Structure

```
src/
├── extension.ts                # Main entry point, activation, command registration
├── ai-providers/               # AI provider integrations
│   ├── aiProvider.ts           # Base provider interface and PROVIDER_PATHS config
│   ├── aiProviderFactory.ts    # Factory for creating provider instances
│   ├── claudeCodeProvider.ts   # Claude Code integration
│   ├── copilotCliProvider.ts   # GitHub Copilot CLI integration
│   ├── geminiCliProvider.ts    # Gemini CLI integration
│   ├── codexCliProvider.ts     # Codex CLI integration
│   ├── qwenCliProvider.ts      # Qwen CLI integration
│   └── index.ts
├── core/                       # Core utilities and shared infrastructure
│   ├── constants.ts
│   ├── types.ts
│   ├── fileWatchers.ts         # Watches .claude/ for changes (debounced 1s)
│   ├── specDirectoryResolver.ts
│   ├── index.ts
│   ├── errors/                 # Error types (index.ts)
│   ├── managers/               # BaseManager.ts, index.ts
│   ├── providers/              # BaseTreeDataProvider.ts, index.ts
│   ├── types/                  # config.ts
│   └── utils/                  # configManager, fileOpener, fileSystemUtils,
│                               # notificationUtils, sanitize, pathUtils,
│                               # installUtils, tempFileUtils, terminalUtils, index.ts
├── features/                   # Feature-specific modules
│   ├── agents/                 # agentManager.ts, index.ts
│   ├── permission/             # Permission caching and config reading (index.ts)
│   ├── settings/               # overviewProvider.ts, index.ts
│   ├── skills/                 # skillManager.ts, index.ts
│   ├── spec-editor/            # specEditorProvider.ts, specDraftManager.ts,
│   │                           # specEditorCommands.ts, tempFileManager.ts, types.ts, index.ts
│   ├── spec-viewer/            # specViewerProvider.ts, specViewerCommands.ts,
│   │                           # messageHandlers.ts, documentScanner.ts,
│   │                           # phaseCalculation.ts, staleness.ts,
│   │                           # types.ts, utils.ts, html/, __tests__/
│   ├── specs/                  # specExplorerProvider.ts, specCommands.ts,
│   │                           # specContextManager.ts, index.ts, __tests__/
│   ├── steering/               # steeringExplorerProvider.ts, steeringManager.ts,
│   │                           # steeringCommands.ts, types.ts, index.ts
│   ├── workflow-editor/        # workflowEditorProvider.ts, workflowEditorCommands.ts,
│   │                           # workflow/, index.ts
│   └── workflows/              # workflowManager.ts, workflowSelector.ts,
│                               # checkpointHandler.ts, types.ts, index.ts
└── speckit/                    # SpecKit CLI integration
    ├── detector.ts             # CLI detection (checks `specify` in PATH)
    ├── cliCommands.ts          # CLI command execution
    ├── updateChecker.ts
    ├── taskProgressService.ts
    ├── utilityCommands.ts
    └── index.ts

webview/
├── src/                        # TypeScript source (browser context)
│   ├── spec-viewer/            # Spec viewer webview
│   │   ├── index.ts
│   │   ├── actions.ts
│   │   ├── elements.ts
│   │   ├── highlighting.ts
│   │   ├── modal.ts
│   │   ├── navigation.ts
│   │   ├── state.ts
│   │   ├── types.ts
│   │   ├── markdown/           # Rendering pipeline (renderer, preprocessors, scenarios)
│   │   └── editor/             # Inline editing (inlineEditor, refinements, lineActions)
│   ├── spec-editor/            # Spec editor webview (index.ts, types.ts)
│   ├── markdown/               # Shared markdown utilities (classifier.ts, parser.ts, index.ts)
│   ├── render/                 # Shared render utilities
│   │   ├── blockRenderer.ts
│   │   ├── contentRenderer.ts
│   │   ├── lineRenderer.ts
│   │   └── index.ts
│   ├── ui/                     # Shared UI components (index.ts, inlineEdit.ts, phaseUI.ts, refinePopover.ts)
│   ├── types.ts
│   └── workflow.ts             # Workflow editor webview
└── styles/                     # CSS stylesheets
    ├── spec-viewer/            # 16 modular CSS partials + index.css
    ├── spec-editor.css
    ├── spec-markdown.css
    ├── spec-viewer.css
    └── workflow.css

assets/                         # Static assets
└── icons/                      # Extension icons (SVG)
```

## Key Components

### Extension Host (Node.js)

**Tree View Providers** — Registered in `package.json`, implement `vscode.TreeDataProvider`:
- `SpecExplorerProvider` (`speckit.views.explorer`): Shows specs from `specs/` directory
- `SteeringExplorerProvider` (`speckit.views.steering`): Shows steering documents
- `OverviewProvider` (`speckit.views.settings`): Settings and overview panel

**Webview Providers** — Implement `vscode.WebviewViewProvider` or `vscode.CustomTextEditorProvider`:
- `SpecViewerProvider`: Renders spec files with phase stepper, badges, and action buttons
- `SpecEditorProvider`: Draft editing for spec files
- `WorkflowEditorProvider`: Custom editor for workflow configuration files

**File Watchers** — Monitor file system for changes:
- `.claude/` directory changes trigger tree view refreshes
- Uses debouncing (1 second) to prevent excessive updates

**Commands** — Registered in `package.json`, handled per feature module:
- Pattern: `speckit.{feature}.{action}` (e.g., `speckit.specs.create`, `speckit.specs.plan`)

**AI Providers** — 5 supported providers via `ai-providers/`:
1. Claude Code (`claudeCodeProvider.ts`)
2. GitHub Copilot CLI (`copilotCliProvider.ts`)
3. Gemini CLI (`geminiCliProvider.ts`)
4. Codex CLI (`codexCliProvider.ts`)
5. Qwen CLI (`qwenCliProvider.ts`)

**Feature Modules** — 10 modules under `features/`:
`agents`, `permission`, `settings`, `skills`, `spec-editor`, `spec-viewer`, `specs`, `steering`, `workflow-editor`, `workflows`

### Webview (Browser)

The spec viewer and workflow editor run in VS Code webviews (sandboxed browser):

```
Extension Host                    Webview
     │                               │
     │  ──── documentChanged ────>   │  (file content)
     │  <──── editSource ────────    │  (user clicks button)
     │  <──── removeLine ────────    │  (user removes line)
     │  <──── refineLine ────────    │  (user refines with AI)
     │                               │
```

Message routing is handled in `messageHandlers.ts` (spec-viewer) and the workflow editor's action handlers.

## Data Flow

### Spec File Opened
1. VS Code opens `.md` file in `specs/` directory
2. `SpecViewerProvider.resolveCustomTextEditor()` called
3. HTML generated with phase stepper, badges, content area
4. Webview receives content, renders with action buttons

### User Clicks "Refine"
1. Webview posts `refineLine` message with line number and instruction
2. Extension receives message in `messageHandlers.ts`
3. Launches AI provider CLI with refinement prompt
4. File updates → `onDidChangeTextDocument` fires
5. Extension sends `documentChanged` to webview
6. Webview re-renders content

## SpecKit CLI Integration

The extension calls the SpecKit CLI (`specify`) for:
- `specify init` - Initialize workspace
- Slash commands via AI CLI: `/speckit.specify`, `/speckit.plan`, etc.

CLI detection: Checks if `specify` command exists in PATH (`speckit/detector.ts`).

### Provider-Specific Command Formats

Different AI CLIs use different naming conventions for SpecKit commands:

| Format | Providers | Example |
|--------|-----------|---------|
| Dot (`speckit.specify`) | Copilot, Gemini, Qwen | `/speckit.specify` |
| Dash (`speckit-specify`) | Claude, Codex | `/speckit-specify` |

This is configured via the `commandFormat` field in `PROVIDER_PATHS` (`src/ai-providers/aiProvider.ts`). To change a provider's format, edit that single field. The `formatCommandForProvider()` helper converts the canonical dot format to the provider-specific format at send-time, keeping workflow configs provider-agnostic.

## State Management

- **In-memory**: Tree view data, webview state
- **File-based**: `specs/*/`, `.claude/settings/speckit-settings.json`, `.spec-context.json` per spec directory
- **VS Code**: Extension context for subscriptions, globalState for persistence

## Extension Points for Contributors

- **Add an AI provider**: Implement the provider interface in `src/ai-providers/`, register in `aiProviderFactory.ts`, add to `PROVIDER_PATHS` in `aiProvider.ts`
- **Add a feature module**: Create a directory under `src/features/` following the Manager/Provider/Commands pattern; register commands in `extension.ts`
- **Add a tree view**: Extend `BaseTreeDataProvider`, register in `package.json` under `contributes.views`, activate in `extension.ts`
- **Add a webview**: Create entry under `webview/src/`, add styles under `webview/styles/`, wire up message handlers in the feature's `messageHandlers.ts`
