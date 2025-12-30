# Architecture

## Overview

SpecKit Companion is a VS Code extension that provides a visual interface for spec-driven development with Claude Code and GitHub SpecKit.

## Directory Structure

```
src/
├── extension.ts          # Main entry point, activation, command registration
├── commands/             # Command handlers (create spec, refine, etc.)
├── constants/            # Configuration constants, paths, patterns
├── features/             # Feature-specific modules
│   └── permission/       # Permission caching and config reading
├── providers/            # VS Code tree view and editor providers
│   ├── specExplorerProvider.ts      # Specs tree view
│   ├── steeringExplorerProvider.ts  # Steering documents tree view
│   ├── agentsExplorerProvider.ts    # Agents tree view
│   ├── hooksExplorerProvider.ts     # Hooks tree view
│   ├── mcpExplorerProvider.ts       # MCP servers tree view
│   └── workflow/                    # Custom editor for spec files
│       ├── workflowEditorProvider.ts
│       ├── htmlGenerator.ts
│       └── actionHandlers.ts
├── services/             # Business logic services
│   └── promptLoader.ts   # Loads prompt templates
├── shared/               # Shared types and utilities
│   └── types/            # TypeScript interfaces
├── utils/                # Utility functions
│   ├── notificationUtils.ts
│   └── updateChecker.ts
└── watchers/             # File system watchers
    └── fileWatchers.ts   # Watches .claude/ for changes

webview/                  # Workflow editor webview
├── src/                  # TypeScript source
│   ├── workflow.ts       # Main webview entry
│   ├── render/           # Content rendering
│   │   └── lineRenderer.ts   # Renders markdown lines with actions
│   ├── markdown/         # Markdown parsing
│   │   └── classifier.ts     # Classifies line types
│   ├── ui/               # UI components
│   └── types.ts          # Webview types
└── styles/               # CSS stylesheets
    ├── workflow.css      # Workflow editor styles
    └── spec-markdown.css # Spec markdown styles

assets/                   # Static assets
├── icons/                # Extension icons (SVG)
└── media/                # Media files (images, HTML)

docs/                     # Documentation assets
└── screenshots/          # README screenshots
```

## Key Components

### Extension Host (Node.js)

**Providers** - Implement VS Code's TreeDataProvider and CustomTextEditorProvider:
- `SpecExplorerProvider`: Shows specs from `specs/` directory
- `WorkflowEditorProvider`: Custom editor for spec/plan/tasks.md files

**Watchers** - Monitor file system for changes:
- `.claude/` directory changes trigger tree view refreshes
- Uses debouncing (1 second) to prevent excessive updates

**Commands** - Registered in `package.json`, handled in `commands/`:
- `speckit.create`, `speckit.specify`, `speckit.plan`, `speckit.tasks`, `speckit.implement`

### Webview (Browser)

The workflow editor runs in a VS Code webview (sandboxed browser):

```
Extension Host                    Webview
     │                               │
     │  ──── documentChanged ────>   │  (file content)
     │  <──── editSource ────────    │  (user clicks button)
     │  <──── removeLine ────────    │  (user removes line)
     │  <──── refineLine ────────    │  (user refines with AI)
     │                               │
```

**Message Types** (src/shared/types/MessageTypes.ts):
- `ExtensionToWebviewMessage`: documentChanged, updatePhaseInfo
- `WebviewToExtensionMessage`: editSource, removeLine, refineLine, generateContent

## Data Flow

### Spec File Opened
1. VS Code opens `.md` file in `specs/` directory
2. `WorkflowEditorProvider.resolveCustomTextEditor()` called
3. HTML generated with phase stepper, content area
4. Webview receives content, renders with action buttons

### User Clicks "Refine"
1. Webview posts `refineLine` message with line number and instruction
2. Extension receives message in `actionHandlers.ts`
3. Launches Claude Code with refinement prompt
4. File updates → `onDidChangeTextDocument` fires
5. Extension sends `documentChanged` to webview
6. Webview re-renders content

## SpecKit CLI Integration

The extension calls the SpecKit CLI (`specify`) for:
- `specify init` - Initialize workspace
- Slash commands via Claude Code: `/speckit.specify`, `/speckit.plan`, etc.

CLI detection: Checks if `specify` command exists in PATH.

## State Management

- **In-memory**: Tree view data, webview state
- **File-based**: `specs/*/`, `.claude/settings/speckit-settings.json`
- **VS Code**: Extension context for subscriptions, globalState for persistence
