# Architecture

SpecKit Companion is a VS Code extension that gives spec-driven development a visual home: a sidebar for browsing specs, a custom editor for reading and editing them inline, and a unified dispatch layer that routes step actions ("specify", "plan", "tasks", "implement") to whichever AI provider the user has configured.

> This document describes **responsibilities** and **boundaries**, not file-by-file inventories. File names rot the moment someone adds or renames a module — `ls src/` and the test `tests/integration/docs-consistency.test.ts` are the live source of truth. The test fails on every `npm test` if a path mentioned here disappears or a new `*Provider.ts` is added without a doc mention.

## The diagram

[`docs/architecture/diagram.html`](./architecture/diagram.html) — open it in a browser. One page, no build, no network. It carries three guided walkthroughs: **the whole loop** (a command leaves VS Code, reaches an AI CLI, runs spec-kit, and comes back as state the UI can read), **eleven CLIs behind one seam**, and **what is written down**. It has a present mode and exports to SVG and PNG.

Read it before the module map below. The prose says what each part is responsible for; the diagram says how a command actually travels, which is the part that is hard to hold in your head from a list.

**It is generated, not drawn.** [`docs/architecture/speckit-companion.architecture.json`](./architecture/speckit-companion.architecture.json) is the source, and [archify](https://www.npmjs.com/package/archify) renders the HTML from it. Edit the JSON and regenerate; do not hand-edit the HTML, and expect anything you do edit there to be lost.

**Its numbers are claims like any other.** They were last checked against the code on 2026-08-30: eleven providers (the `speckit.aiProvider` enum, matching the column count in [providers.md](./providers.md)), ten feature modules under `src/features/`, 167 source and doc files under `webview/src/`. The generator does not count anything for you, so a provider added without touching this file leaves the diagram quietly wrong — which it already was, claiming nine.

## High-level layout

The extension splits into three runtime layers and one configuration surface:

- **Extension host** (`src/`) — Node.js code that owns tree views, custom editors, file watchers, terminal dispatch, and the `.spec-context.json` lifecycle.
- **Webview** (`webview/src/`) — sandboxed-browser Preact code that renders the spec viewer and the spec/workflow editors. It receives state from the extension via `postMessage` and never touches the filesystem itself.
- **Static assets** (`assets/`, `webview/styles/`) — icons and CSS partials, plus `assets/sample-spec/` (the bundled sample the welcome seeds) and `assets/walkthrough/` (the media behind `contributes.walkthroughs`).
- **Manifest** (`package.json`) — declarative contributions (views, commands, menus, configuration enums).

The repo also carries a **marketing and documentation site** at `website/`: an Astro project with the Starlight docs integration, static output, deployed by Vercel from its own `package.json` and lockfile. It ships to nobody through the extension, because `.vscodeignore` excludes `website/**` from the `.vsix`, and no code under `src/` or `webview/src/` imports from it. The one coupling that runs the other way is visual: the Storybook capture palette is anchored to `website/src/styles/tokens.css`, and parts of `website/public/` are build outputs of scripts in this repo — `public/media/` from `website/scripts/sync-media.mjs`, `public/mascot/` from `scripts/build-mascot-assets.mjs`, `public/favicon-*.png` from `scripts/build-favicons.mjs`. The site's `build` script runs `sync:media` before `astro build`, so a deploy pulls in `media/web/` on its own. See [`visual-assets.md`](./visual-assets.md).

Alongside it, `scripts/` at the repo root is **build-time tooling, not runtime code**: the Storybook capture runner, the clip encoders, the still, lightwell, favicon and mascot builders, and the manifest and storyboard checkers. `.vscodeignore` excludes `scripts/**` from the `.vsix`, nothing under `src/` imports from it, and the two documents that own its rules are [`visual-assets.md`](./visual-assets.md) and [`media-manifest.md`](./media-manifest.md). Its one tracked output directory is `media/web/`, which is in git deliberately — a deploy cannot rebuild it, and while it was ignored the live site rendered every clip and screenshot as a broken image.

The repo also ships a **separate, independently-versioned spec-kit extension** under `speckit-extension/` (its own README/CHANGELOG/`extension.yml`). Its Companion commands are assembled from composable **nodes** by `scripts/assemble-nodes.py` (with `scripts/companion_config.py` as the executable spec of the `.specify/companion.yml` hook/recipe contract); see [`speckit-extension/docs/node-model.md`](../speckit-extension/docs/node-model.md). The VS Code extension does not depend on these at runtime — it only dispatches command text the host resolves.

Its capture scripts split by responsibility, in a one-way dependency order: `spec_context.py` (the `.spec-context.json` store, feature-dir resolution, the history log, the canonical vocabulary) and `spec_deltas.py` (the requirement-delta grammar) sit at the bottom with no local dependencies; `capture.py` (the additive capture writers) and `task_sync.py` (task markers, checkboxes, the per-task journal) build on the store; `living_spec_fold.py` (the fold-back) builds on all three; and `write-context.py` sits on top holding the command line, the step lifecycle, journal finish/advance, terminal promotion, and the no-regress guard. `write-context.py` re-exports every sibling name, so `derive-from-files.py`, `status-context.py`, the Python test suites, and the eval skills all keep importing one module. Any new sibling must be added to `package-manifest.py`'s `RUNTIME_SCRIPTS` **and** given a `!` rule in `.vscodeignore` (two packing lists — one per extension), and imported by plain name — the packaging gate derives what ships by following plain imports, so a dynamically-loaded module would ship missing. `package-manifest.py --check` fails when either list falls behind. Full reference: [`capture-and-timing.md`](./capture-and-timing.md).

## Extension host (`src/`)

The host code organises around four directories, each with a single responsibility.

### `src/extension.ts`

Entry point. Registers tree-data providers, custom editors, file watchers, and commands during `activate()`. Owns the `ExtensionContext.subscriptions` lifecycle. Calls into feature modules for everything beyond wiring.

### `src/ai-providers/`

The provider abstraction layer. `src/ai-providers/aiProvider.ts` defines the `IAIProvider` interface plus the `PROVIDER_PATHS` configuration record (steering file, agents dir, MCP config, command format) for each supported provider. `src/ai-providers/aiProviderFactory.ts` constructs the right concrete provider for the active `speckit.aiProvider` setting, with a fallback path for renamed enum values (see the [feedback_provider_rename_breaks_settings memory] for why this fallback exists).

Eleven providers ship today, in three shapes:

- **Terminal CLI providers** — spawn a `vscode.window.createTerminal()`, write a temp prompt file, `sendText` the invocation, schedule cleanup. The shared workflow lives in `cliTerminalProvider.ts` (abstract base). Concrete subclasses: `claudeCodeProvider.ts`, `copilotCliProvider.ts`, `codexCliProvider.ts`, `qwenCliProvider.ts`, `openCodeProvider.ts`, `antigravityCliProvider.ts` (Google's Antigravity CLI, default temp-file dispatch). The base owns ensure-installed → temp-file → terminal → sendText → cleanup; subclasses supply a `prepareDispatch()` hook returning the command line and temp-file list. `geminiCliProvider.ts` and `wibeyCliProvider.ts` stay outside this hierarchy — both CLIs run interactively (TUI-first tools) and the prompt is delivered via post-init `sendText` after the process boots, not via a temp-file dispatch. `wibeyCliProvider.ts` additionally reuses an existing live "SpecKit - Wibey" terminal when one is found via `vscode.window.terminals`, avoiding a new process on every dispatch.
- **IDE-chat provider** — `ideChatProvider.ts` routes the assembled prompt into the host editor's built-in chat surface (Copilot in VS Code, Composer in Cursor, Cascade in Windsurf) instead of spawning a terminal. The host editor resolves `/speckit.*` slash commands itself.
- **Panel providers** — bypass the terminal entirely. `claudePanelProvider.ts` drives the Claude Code GUI panel via a URI handler (`vscode://anthropic.claude-code/open?prompt=…`). `wibeyPanelProvider.ts` targets the Wibey chat panel via a two-step runtime waterfall probed on every dispatch: (1) `wibey.sendPrompt(text)` command (progressive enhancement, requires genaica/wibey-vscode-extension#442); (2) clipboard + `wibey.openChat` fallback — copies the command and notifies the user to paste, the same pattern `ideChatProvider.ts` uses for Windsurf/Cascade. A URI-handler path was considered but disabled: `vscode.env.openExternal` returns `true` even when the target extension has no registered `UriHandler`, silently swallowing the dispatch.

Shared helpers live alongside the providers: `promptBuilder.ts` assembles the canonical prompt, `permissionValidation.ts` checks auto-approve flag shape, `initOptions.ts` handles workspace-initialization checks, `codexCommandBuilder.ts` assembles the `codex exec -` pipe, and `codexPromptResolver.ts` turns a `/speckit.*` slash command into the prompt body Codex actually receives. Codex has no client-side slash-command registry, so the extension substitutes the command template itself: it splits off the context preamble, reads the skill spec-kit emits for Codex (`.agents/skills/<skill>/SKILL.md` — `/speckit.companion.plan` and its dashed twin `/speckit-companion-plan` both resolve to `speckit-companion-plan`), substitutes everything after the command verb into `$ARGUMENTS`, and re-attaches the preamble ahead of the body so capture still fires. It falls back to the deprecated prompts layout (`.codex/prompts/<command>.md`) that older `specify init --ai codex` workspaces carry. A command with no template on disk degrades to a short instructional wrapper. `providerRegistry.ts` is the runtime validation layer for the `PROVIDER_PATHS` blob — each entry is checked at module load so a typo'd `commandFormat`, an `autoApproveFlag` missing its trailing space, or a malformed codicon throws on activation rather than misbehaving at first dispatch.

### `src/core/`

Cross-cutting infrastructure that features build on; nothing in `core/` imports from `features/` or `ai-providers/`. `tests/integration/docs-consistency.test.ts` enforces that with an allowlist that only shrinks: `src/core/telemetry.ts` (reads and backfills a spec's telemetry id through the spec-context reader/writer) and `src/core/utils/terminalUtils.ts` (the `AIExecutionResult` type). Resolves the user's spec directory list (`src/core/specDirectoryResolver.ts`), migrates retired settings at activation (`src/core/settingsMigration.ts`, at the User and Workspace scopes only, since every `speckit.*` key is window- or machine-scoped and VS Code rejects folder-level writes for those), and exposes the canonical constants table (`src/core/constants.ts`) and the `.spec-context.json` contract (`src/core/types/specContext.ts`). Sub-directories `core/errors/`, `core/managers/`, `core/providers/` hold base classes (`src/core/providers/BaseTreeDataProvider.ts` is the parent for all sidebar providers); `core/utils/` holds the small-helper grab-bag (config reading, file opening, sanitization, terminal helpers, and the spec display-name derivation in `src/core/utils/specDisplayName.ts`).

### `src/features/`

Each subdirectory is one user-facing capability, structured around a *manager* (owns file I/O and business logic) and a *provider* (owns the VS Code API surface — tree view, webview, custom editor). Commands are registered per feature.

`src/features/fileWatchers.ts` sits at the top of this layer because it orchestrates across it: it watches the filesystem (1-second debounce on `.claude/` changes, `tasks.md` and `.spec-context.json` watchers over every configured spec directory) and fans changes out to the specs, steering and spec-viewer providers, the step lifecycle and the transition logger. `extension.ts` wires it after those providers exist.

The two most active features:

- **`features/specs/`** — the spec sidebar (`specExplorerProvider.ts`), the command pack (`src/features/specs/specCommands.ts`: create, mark-complete, archive, sort, filter, etc.), the `.spec-context.json` read/write split (`specContextReader.ts` / `specContextWriter.ts`, with `specContextBackfill.ts` and `specContextReconciler.ts` handling migration, and `specContextManager.ts` as a documented compatibility shim returning the legacy `FeatureWorkflowContext` shape for callers that haven't migrated to the canonical `SpecContext` type yet), step lifecycle (`stepLifecycle.ts`, `stepHistoryDerivation.ts`), the sidebar filter/sort state (`specsFilterState.ts`, `specsSortState.ts`, `fuzzyMatch.ts`), and the custom-command config normaliser (`customCommandConfig.ts`).
- **`features/spec-viewer/`** — the custom-editor surface (`specViewerProvider.ts`), the webview message router (`messageHandlers.ts`), the pure derivation pipeline (`panelStateComputer.ts` — extracted in Phase 3 to share between the full-render and tab-click paths), the panel-instance registry (`panelRegistry.ts` — Phase 12, owns the `Map<specDir, PanelInstance>` plus debounce-timer cleanup so the provider deals with a typed API not raw Map ops), and the helpers around them (`stateDerivation.ts`, `phaseCalculation.ts`, `staleness.ts`, `footerActions.ts`, `documentScanner.ts`). `messageHandlers.ts` was restructured in Phase 4: the 140-line switch is now a typed dispatch map built on the generic `createDispatcher` utility in `src/core/utils/dispatcher.ts` (Phase 10), the three duplicate command-resolution loops in `handleClarify` collapsed behind a shared `matchesCommand` + `dispatchEnhancement` pair, and the module-scope `commentWriteQueues` Map became an encapsulated `CommentMutationQueue` class. `specViewerProvider.ts` dropped from 1110 LOC (pre-refactor) to ~920 LOC after Phases 3 and 12.

`src/features/pipeline-builder/` holds the Pipeline Builder panel. It draws the pipeline a build would produce — steps, phases, nodes, hooks, decisions, artifacts — and dispatches the same build commands the palette does. The structure it renders is not derived here: `speckit-extension/scripts/pipeline-graph.py` resolves it from the project's `companion.yml` through the same code the build command uses, and `src/features/specs/pipelineGraph.ts` reads that JSON. A second derivation in TypeScript would drift from the first within a release.

`src/features/specs/pipelineBuild.ts` answers whether the built commands are still current with the configuration behind them, on the same modified-time rule the viewer uses for a plan older than its spec.

Other feature folders: `features/spec-editor/` (draft editor + temp-file lifecycle), `features/steering/` (project + user steering docs), `features/agents/`, `features/skills/`, `features/permission/`, `features/workflows/`, `features/settings/`. Each follows the same manager + provider + commands pattern.

### `src/speckit/`

The SpecKit CLI integration. Detects `specify` on PATH, runs `specify init`, polls task progress, and surfaces utility commands.

## Webview (`webview/src/`)

The webview is in a partial Preact migration. Components live under `webview/src/spec-viewer/components/` (`App.tsx`, `FooterActions.tsx`, `NavigationBar.tsx`, `StepTab.tsx`, the `cards/` subtree, etc.) with module-scoped signals in `webview/src/spec-viewer/signals.ts` carrying the shared state (`navState`, `viewerState`, `activityVisible`). Stories sit alongside their components as `*.stories.tsx` and are the visual baseline.

The migration is **not complete**. A parallel imperative pipeline still owns markdown rendering: `webview/src/spec-viewer/markdown/renderer.ts` produces an HTML string that the App component injects via `dangerouslySetInnerHTML`, then imperative helpers (`webview/src/spec-viewer/editor/inlineEditor.ts`, `webview/src/spec-viewer/editor/refinements.ts`, `webview/src/spec-viewer/actions.ts`, `webview/src/spec-viewer/toc.ts`) manually mount components into slots the string left behind. This hybrid is the subject of refactor Phase 5 — the goal is to make `renderMarkdown()` return JSX directly and delete the imperative helpers.

Shared webview surfaces:

- `webview/src/spec-editor/` — the draft editor entry (`index.ts`) plus its Storybook mock (`CreateSpecMock.tsx`).
- `webview/src/shared/` — reusable components and hooks.

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

Capture into `history[]` comes from two surfaces: **deterministic** writes (GUI buttons via `stepLifecycle.ts`, and in-command hook scripts → `write-context.py`, both `by:extension`) and **best-effort** AI journaling (the timing partial, `by:ai`). The split — and why timing fidelity is exact for the former and coarse for the latter — is documented in `docs/capture-and-timing.md`.

## Configuration

User-visible settings are declared in `package.json` under `contributes.configuration`. The most relevant ones:

- `speckit.aiProvider` — selects the active provider. Its enum is the canonical provider list; the README "Supported AI Providers" matrix and this document's prose are checked against it on every `npm test`.
- `speckit.specDirectories` — list of directories the spec sidebar reads from.

Each CLI provider invokes its binary by bare name from `PATH` (`claude`, `gemini`, `copilot`, `qwen`, `opencode`); there are no per-provider path-override settings.

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
- `docs/capture-and-timing.md` — how `.spec-context.json` gets written (deterministic hooks vs best-effort AI journaling), the preset/command-override mechanism, install paths, and what the eval asserts.
- `speckit-extension/docs/node-model.md` — how the spec-kit extension's Companion commands are composed from nodes, the `.specify/companion.yml` hook/recipe model, and the byte-parity assembler.
- `docs/visual-assets.md` — how every documentation image, README GIF, web clip and mascot derivative is produced, and the capture palette that decides their colours.
- `docs/media-manifest.md` — the feature asset bundle contract: which output each surface reads, and what `media/manifest.json` records.
