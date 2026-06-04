# Architecture

SpecKit Companion is a VS Code extension that gives spec-driven development a visual home: a sidebar for browsing specs, a custom editor for reading and editing them inline, and a unified dispatch layer that routes step actions ("specify", "plan", "tasks", "implement") to whichever AI provider the user has configured.

> This document describes **responsibilities** and **boundaries**, not file-by-file inventories. File names rot the moment someone adds or renames a module — `ls src/` and the test `tests/integration/docs-consistency.test.ts` are the live source of truth. The test fails on every `npm test` if a path mentioned here disappears or a new `*Provider.ts` is added without a doc mention.

## High-level layout

The extension splits into three runtime layers and one configuration surface:

- **Extension host** (`src/`) — Node.js code that owns tree views, custom editors, file watchers, terminal dispatch, and the `.spec-context.json` lifecycle.
- **Webview** (`webview/src/`) — sandboxed-browser Preact code that renders the spec viewer and the spec/workflow editors. It receives state from the extension via `postMessage` and never touches the filesystem itself.
- **Static assets** (`assets/`, `webview/styles/`) — icons and CSS partials.
- **Manifest** (`package.json`) — declarative contributions (views, commands, menus, configuration enums).

## Extension host (`src/`)

The host code organises around four directories, each with a single responsibility.

### `src/extension.ts`

Entry point. Registers tree-data providers, custom editors, file watchers, and commands during `activate()`. Owns the `ExtensionContext.subscriptions` lifecycle. Calls into feature modules for everything beyond wiring.

### `src/ai-providers/`

The provider abstraction layer. `src/ai-providers/aiProvider.ts` defines the `IAIProvider` interface plus the `PROVIDER_PATHS` configuration record (steering file, agents dir, MCP config, command format) for each supported provider. `src/ai-providers/aiProviderFactory.ts` constructs the right concrete provider for the active `speckit.aiProvider` setting, with a fallback path for renamed enum values (see the [feedback_provider_rename_breaks_settings memory] for why this fallback exists).

Eight providers ship today, in three shapes:

- **Terminal CLI providers** — spawn a `vscode.window.createTerminal()`, write a temp prompt file, `sendText` the invocation, schedule cleanup. The shared workflow lives in `cliTerminalProvider.ts` (abstract base). Concrete subclasses: `claudeCodeProvider.ts`, `copilotCliProvider.ts`, `codexCliProvider.ts`, `qwenCliProvider.ts`, `openCodeProvider.ts`. The base owns ensure-installed → temp-file → terminal → sendText → cleanup; subclasses supply a `prepareDispatch()` hook returning the command line and temp-file list. `geminiCliProvider.ts` stays outside this hierarchy — its CLI runs interactively and the prompt is delivered via post-init `sendText`, not a prompt-file dispatch.
- **IDE-chat provider** — `ideChatProvider.ts` routes the assembled prompt into the host editor's built-in chat surface (Copilot in VS Code, Composer in Cursor, Cascade in Windsurf) instead of spawning a terminal. The host editor resolves `/speckit.*` slash commands itself.
- **Claude-in-VS-Code panel** — `claudePanelProvider.ts` drives the Claude Code GUI panel through the editor's command surface, bypassing the terminal entirely.

Shared helpers live alongside the providers: `promptBuilder.ts` assembles the canonical prompt, `permissionValidation.ts` checks auto-approve flag shape, `initOptions.ts` handles workspace-initialization checks, `codexCommandBuilder.ts` handles Codex's `.codex/prompts/` template branch. `providerRegistry.ts` is the runtime validation layer for the `PROVIDER_PATHS` blob — each entry is checked at module load so a typo'd `commandFormat`, an `autoApproveFlag` missing its trailing space, or a malformed codicon throws on activation rather than misbehaving at first dispatch.

### `src/core/`

Cross-cutting infrastructure. Watches the filesystem (`src/core/fileWatchers.ts`, 1-second debounce on `.claude/` changes), resolves the user's spec directory list (`src/core/specDirectoryResolver.ts`), and exposes the canonical constants table (`src/core/constants.ts`) and shared types (`src/core/types.ts`). Sub-directories `core/errors/`, `core/managers/`, `core/providers/` hold base classes (`src/core/providers/BaseTreeDataProvider.ts` is the parent for all sidebar providers); `core/utils/` holds the small-helper grab-bag (config reading, file opening, sanitization, terminal helpers).

### `src/features/`

Each subdirectory is one user-facing capability, structured around a *manager* (owns file I/O and business logic) and a *provider* (owns the VS Code API surface — tree view, webview, custom editor). Commands are registered per feature.

The two most active features:

- **`features/specs/`** — the spec sidebar (`specExplorerProvider.ts`), the command pack (`src/features/specs/specCommands.ts`: create, mark-complete, archive, sort, filter, etc.), the `.spec-context.json` read/write split (`specContextReader.ts` / `specContextWriter.ts`, with `specContextBackfill.ts` and `specContextReconciler.ts` handling migration, and `specContextManager.ts` as a documented compatibility shim returning the legacy `FeatureWorkflowContext` shape for callers that haven't migrated to the canonical `SpecContext` type yet), step lifecycle (`stepLifecycle.ts`, `stepHistoryDerivation.ts`), the sidebar filter/sort state (`specsFilterState.ts`, `specsSortState.ts`, `fuzzyMatch.ts`), and the custom-command config normaliser (`customCommandConfig.ts`).
- **`features/spec-viewer/`** — the custom-editor surface (`specViewerProvider.ts`), the webview message router (`messageHandlers.ts`), the pure derivation pipeline (`panelStateComputer.ts` — extracted in Phase 3 to share between the full-render and tab-click paths), the panel-instance registry (`panelRegistry.ts` — Phase 12, owns the `Map<specDir, PanelInstance>` plus debounce-timer cleanup so the provider deals with a typed API not raw Map ops), and the helpers around them (`stateDerivation.ts`, `phaseCalculation.ts`, `staleness.ts`, `footerActions.ts`, `documentScanner.ts`). `messageHandlers.ts` was restructured in Phase 4: the 140-line switch is now a typed dispatch map built on the generic `createDispatcher` utility in `src/core/utils/dispatcher.ts` (Phase 10), the three duplicate command-resolution loops in `handleClarify` collapsed behind a shared `matchesCommand` + `dispatchEnhancement` pair, and the module-scope `commentWriteQueues` Map became an encapsulated `CommentMutationQueue` class. `specViewerProvider.ts` dropped from 1110 LOC (pre-refactor) to ~920 LOC after Phases 3 and 12.

Other feature folders: `features/spec-editor/` (draft editor + temp-file lifecycle), `features/steering/` (project + user steering docs), `features/agents/`, `features/skills/`, `features/permission/`, `features/workflows/`, `features/workflow-editor/`, `features/settings/`. Each follows the same manager + provider + commands pattern.

### `src/speckit/`

The SpecKit CLI integration. Detects `specify` on PATH, runs `specify init`, polls task progress, and surfaces utility commands.

## Webview (`webview/src/`)

The webview is in a partial Preact migration. Components live under `webview/src/spec-viewer/components/` (`App.tsx`, `FooterActions.tsx`, `NavigationBar.tsx`, `StepTab.tsx`, the `cards/` subtree, etc.) with module-scoped signals in `webview/src/spec-viewer/signals.ts` carrying the shared state (`navState`, `viewerState`, `activityVisible`). Stories sit alongside their components as `*.stories.tsx` and are the visual baseline.

The migration is **not complete**. A parallel imperative pipeline still owns markdown rendering: `webview/src/spec-viewer/markdown/renderer.ts` produces an HTML string that the App component injects via `dangerouslySetInnerHTML`, then imperative helpers (`webview/src/spec-viewer/editor/inlineEditor.ts`, `webview/src/spec-viewer/editor/refinements.ts`, `webview/src/spec-viewer/actions.ts`, `webview/src/spec-viewer/toc.ts` (the orphan `modal.ts` was deleted in Phase 5b — its modal was unreached after the dynamic `webview/src/ui/refinePopover.ts` took over the refine flow)) manually mount components into slots the string left behind. This hybrid is the subject of refactor Phase 5 — the goal is to make `renderMarkdown()` return JSX directly and delete the imperative helpers.

Shared webview surfaces:

- `webview/src/markdown/` — markdown classification + parsing utilities shared across viewer and editor.
- `webview/src/render/` — block/line/content renderers used by the imperative pipeline (will shrink with Phase 5).
- `webview/src/ui/` — small composable UI primitives (inline-edit input, phase pill, refine popover).
- `webview/src/spec-editor/` — the draft editor entry (`index.ts`) plus its Storybook mock (`CreateSpecMock.tsx`).
- `webview/src/workflow.ts` — the workflow editor webview.
- `webview/src/shared/` — reusable components (`UndoToast.tsx`) and hooks (`useInlineConfirm.ts`).

Stylesheets live in `webview/styles/`, with the spec viewer's CSS broken into modular partials under `webview/styles/spec-viewer/`.

## Data flow

```
Extension host                    Webview
     │                               │
     │  ──── contentUpdated ────>    │  (file + nav state)
     │  <──── switchDocument ────    │  (tab click)
     │  <──── editLine ──────────    │  (inline edit)
     │  <──── refineLine ────────    │  (AI refine)
     │  <──── commentAdd/remove ─    │  (review comment)
     │                               │
```

Spec context (`.spec-context.json`) is the canonical store. The host owns all writes; the webview reads derived state via the message channel. When a user advances a step, the host updates context, fires a refresh, and the sidebar re-renders. See `docs/spec-context-schema.md` for the schema.

## Configuration

User-visible settings are declared in `package.json` under `contributes.configuration`. The most relevant ones:

- `speckit.aiProvider` — selects the active provider. Its enum is the canonical provider list; the README "Supported AI Providers" matrix and this document's prose are checked against it on every `npm test`.
- `speckit.specDirectories` — list of directories the spec sidebar reads from.
- Per-provider path overrides (`speckit.geminiPath`, `speckit.copilotPath`, etc.) and timing knobs (`speckit.geminiInitDelay`).

User data is stored under the workspace `.claude/` and `specs/` directories, plus the user's home `~/.claude/`. None of these are shipped in the `.vsix`; the extension only reads them at runtime.

## Extension points

- **Adding a provider**: implement `IAIProvider`, register in `aiProviderFactory.ts`, add a `PROVIDER_PATHS` entry, add the enum value to `package.json`, add a column to the README matrix, name the new `*Provider.ts` file at least once in this document. The docs-consistency test (`tests/integration/docs-consistency.test.ts`) enforces the last three.
- **Adding a feature module**: create `src/features/<name>/` with a manager + provider + commands; register in `extension.ts`.
- **Adding a tree view**: extend `BaseTreeDataProvider`, declare under `contributes.views` in `package.json`, activate in `extension.ts`.
- **Adding a webview surface**: create a Preact entry under `webview/src/`, add styles under `webview/styles/`, wire message handlers in the feature's `messageHandlers.ts`. New components must ship with a `*.stories.tsx`.

## Related documents

- `docs/refactor-plan.md` — the structural-cleanup plan, including the prevention strategy this doc participates in.
- `docs/spec-context-schema.md` — the on-disk schema for `.spec-context.json`.
- `docs/viewer-states.md` — the full state machine for the spec viewer.
- `docs/sidebar.md` — long-form sidebar reference.
- `docs/how-it-works.md` — narrative walk-through that complements this structural overview.
