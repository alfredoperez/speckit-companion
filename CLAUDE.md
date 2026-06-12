# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VSCode extension called "SpecKit Companion" that enhances AI assistants (terminal CLIs, the host editor's built-in chat, and the Claude Code GUI panel) with structured spec-driven development features. The full provider list is the README "Supported AI Providers" matrix — see [`README.md`](./README.md#supported-ai-providers). The extension provides visual management of specs (requirements, design, tasks) and steering documents.

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

When adding, changing, or removing a user-facing feature, update README.md. The README is the single source of truth for configuration, workflows, and features. Use the map below to find the right section.

**Docs are part of the change, not a follow-up.** Any time you touch behavior, configuration, commands, the pipeline, or architecture, update the matching doc in the *same* change — before the work counts as done. Before finishing, scan the map below and the long-form references (`docs/*.md`, the two READMEs, the relevant CHANGELOG); if the change lands in an area that has a dedicated doc, updating that doc is required, not optional. A behavior change without its doc update is an incomplete change.

When modifying spec viewer statuses, badges, buttons, or step tab behavior, also update `docs/viewer-states.md` (full state machine: status lifecycle, footer button matrix, badge text logic, step tab visual states, data flow).

When modifying the companion template profiles — the `companion-standard` / `companion-turbo` presets, their command bodies, the shared timing partial, the `speckit.companion.templateProfile` setting, the per-spec profile control, or the preset reconciler — also update `docs/template-profiles.md` (the living reference for the two profiles, the commands-vs-templates mechanism, the per-file turbo treatment, the timing partial, and the selection model).

When modifying the project structure, adding/removing modules, or changing the architecture, also update `docs/architecture.md`.

When modifying how `.spec-context.json` gets captured — the lifecycle hooks, `write-context.py`, the timing partial (`speckit-extension/presets/_shared/timing-partial.md` / `promptBuilder.ts`), the preset command-override mechanism, `derive-from-files.py`, or the eval (`check_capture.py`) — also update `docs/capture-and-timing.md` (the deterministic-vs-best-effort capture model, the reliability principle, install paths, known timing gaps, and what the eval asserts). Don't re-derive this flow from the code each time; this doc is the map.

When modifying the sidebar (filter, sort, lifecycle buttons, badge tiers, tree icons, transition logging), also update `docs/sidebar.md` (the long-form sidebar reference linked from the README).

When modifying a webview component (`webview/src/spec-viewer/components/`, `webview/src/spec-editor/`, etc.) that has a sibling `.stories.tsx` file, update the stories in the same change to cover the new state/variant. Storybook is the visual baseline for these components — stale stories are worse than missing stories because they lie. If a component changes materially and no `.stories.tsx` exists, add one in the same PR.

### Two extensions, two sets of docs (critical)

This repo ships **two independently-versioned extensions**, each with its **own** README, CHANGELOG, version, release flow, and tag namespace. Do not conflate them:

| | VS Code extension | spec-kit extension (`id: companion`) |
|---|---|---|
| README / CHANGELOG | root `README.md` / `CHANGELOG.md` | `speckit-extension/README.md` / `speckit-extension/CHANGELOG.md` |
| Version | `package.json` `version` | `speckit-extension/extension.yml` `extension.version` |
| Release | `/publish` or `/ship` → **`v*`** tag → `release.yml` → Marketplace/OpenVSX | `/publish-speckit-ext` → **`speckit-ext-v*`** tag → GitHub release → spec-kit catalog (`speckit-extension/docs/publishing.md`) |

To release both in one pass, use `/publish-both` — it runs `/publish` then `/publish-speckit-ext` sequentially (versions asked once up front, no rollback of phase 1 if phase 2 fails).

A change under `speckit-extension/` updates **its** README/CHANGELOG/version, **never** the root ones (and vice-versa). The two changelogs may both describe a feature that spans the GUI and the spec-kit side (e.g. status/resume) — each from its own half; that overlap is expected. **Never edit `.specify/extensions/companion/CHANGELOG.md`** — it's a generated copy of the source, gitignored, and overwritten on every install.

### Feature → README section map

| Change you made | README section to update |
|-----------------|--------------------------|
| New AI provider | "Supported AI Providers" matrix (add column) + provider count anywhere it's stated (e.g. "Six providers ship today" in "Why it exists") + `package.json` `contributes.configuration["speckit.aiProvider"].enum` must match |
| New canonical workflow status | "Header badge color tiers" in `docs/sidebar.md` + "Status vocabulary" under Spec Context in README |
| New configuration setting | "Configuration" section in README (add subsection with JSON example + value table) |
| New sidebar action / right-click menu item | `docs/sidebar.md` (full reference) + the brief "Sidebar at a Glance" summary in README |
| New keyboard or visual safety affordance | "Safety Affordances for Destructive Actions" in README |
| New workflow phase or sub-document type | "Spec-Driven Phases" in README + Step Properties table under Custom Workflows |
| New custom command type | "Custom Commands" properties table in README |
| New platform support / shell support | "Platform Support" table in README |
| New webview UI element (header, badge, tab, etc.) | "Reading Specs" subsection in README + retake associated screenshot |
| Modified webview component with a sibling `.stories.tsx` | Update the stories to exercise the new state/variant; if there is no story file for a non-trivial component being modified, add one |
| Bug fix that changes documented behavior | The README section that documented the broken behavior |
| Change under `speckit-extension/` (commands, scripts, hooks, manifest) | `speckit-extension/README.md` + `speckit-extension/CHANGELOG.md` + `extension.yml` `version` — **not** the root README/CHANGELOG/`package.json`. Release with `/publish-speckit-ext`. A new command must be added to `extension.yml` `provides.commands` or the installer skips it. |

### Per-release checklist (run before tagging a version)

> This checklist is for the **VS Code extension** (`/publish`/`/ship`, `v*` tag). The **spec-kit extension** has its own flow — see `/publish-speckit-ext` and `speckit-extension/docs/publishing.md` (prefixed `speckit-ext-v*` tag, `.zip` archive, catalog issue).

1. Run `git diff $(git describe --tags --abbrev=0)..HEAD -- README.md` to see what was already updated since the last tag.
2. Cross-check `CHANGELOG.md` entries since the last release against the map above.
3. For every CHANGELOG bullet under "New Features," confirm a README section was touched. If not, add one.
4. Update the "Recently Shipped" block at the top of README with the current and previous two releases.
5. Verify `package.json` `contributes.configuration["speckit.aiProvider"].enum` matches the README provider matrix (count + names).
6. Verify `package.json` `engines.vscode` matches the README "VS Code" badge.
7. Re-render any screenshot whose UI changed in this release and refresh its caption if the value prop shifted.
   - **Keep screenshot filenames stable — overwrite in place, never rename or delete.** README image URLs are absolute and pinned to the `main` branch (`raw.githubusercontent.com/.../main/docs/screenshots/<file>`). The Marketplace serves the *last published* README but resolves those URLs against the *current* `main`, so renaming or deleting a referenced screenshot retroactively 404s the published listing (this is what broke the v0.18.0 listing after the "lean image set" refactor). Re-shoot into the existing filename instead.

When in doubt, look at how an existing feature is documented and follow the same pattern.

### Changelog voice

Changelog entries are **release notes for users**, not commit messages. Lead with the observable change — what a user can now do, or what stopped going wrong. Keep the things users actually touch: setting keys (`speckit.companion.templateProfile`), command names (`/speckit.companion.resume`), config files they edit, and the install commands they run. **Drop internal file and symbol names** — `promptBuilder.ts`, `stepHistoryDerivation`, `sync_tasks()`, `write-context.py --task …`, `CROSS_STEP_TERMINAL`, on-disk field names like `history[]`/`transitions[]`. Those belong in the commit message or PR description, where a maintainer chasing the mechanism will find them. The test: would the entry make sense to someone who has never opened `src/`? If it only lands for someone who has, it's too deep — move the mechanism out and keep the effect. This applies to both changelogs (root and `speckit-extension/`).

### Markdown formatting

**No hard-wrapped paragraphs.** Every prose paragraph in any `.md` file in this repo (`README.md`, `CHANGELOG.md`, `CLAUDE.md`, anything under `docs/`, `specs/`, etc.) is a single logical line. Do not insert newlines mid-paragraph to fit a column width — modern editors soft-wrap, and hard-wrapping makes diffs noisier and edits harder. The only newlines inside a paragraph come from explicit Markdown breaks (two trailing spaces or `<br>`); the only newlines between paragraphs are blank-line separators. Bullets, table rows, code blocks, and headings remain on their own lines as usual.

## Extension Isolation (critical)

The installed SpecKit Companion extension ships ONLY what is packaged into the `.vsix` (code under `src/`, bundled webview, assets). It does NOT ship:

- `.claude/skills/**` — dev-workspace skills; users don't have them.
- `.specify/templates/**`, `.specify/extensions.yml`, `.specify/scripts/**` — these belong to the SpecKit CLI / user's own workspace.
- `.claude/**` in general — user-local AI setup.

Any runtime behavior the extension needs must work without any of those files. Treat them as read-only from the extension's perspective.

Correct surfaces for extension-owned behavior:

1. **Extension command handlers** (`src/features/specs/specCommands.ts`, viewer message handlers) — direct writes via `specContextWriter`.
2. **Prompt text the extension builds** for the AI CLI (in `ai-providers/*` / `executeInTerminal(prompt)`) — prepend/append instructions here; this text is assembled at runtime by shipped code.

Do NOT modify `.claude/**` or `.specify/**` to implement extension features. If the feature needs the AI to do something, have the extension embed the instruction in the prompt it dispatches.

**Exception — committed spec-kit scaffolding for IDE Chat testing.** The `.specify/`, `.cursor/`, `.windsurf/`, `.agents/`, `.gemini/`, `.qwen/`, and `.github/{agents,prompts}/speckit.*` directories are checked in as **manual-testing fixtures** — they're the output of `specify init --ai <agent>` for each host editor, so the IDE Chat provider can be exercised against real `/speckit.*` commands in Copilot / Cursor / Windsurf / Antigravity. The extension still does **not** read or depend on these at runtime (it only dispatches command text; the host chat resolves them), and they are not shipped in the `.vsix`. Don't delete them as an "isolation violation" — they're test setup, not extension behavior.

## Code Comments

Default to writing **no comment**. Only add one when removing it would surprise a future reader (a hidden constraint, a non-obvious invariant, a workaround for a specific runtime quirk). If the rationale needs a paragraph, the WHY belongs in the commit message or PR description, not in the source. Specifically for this repo:

- **No spec / PR / finding identifiers in code comments.** Don't write `// (spec 112)`, `// per F12`, `// per PR #182`, `// round-3 cleanup`. These rot the moment the PR thread moves on; a future reader who needs the context can run `git log -L :functionName:path/to/file` or open the PR. The codebase has been accumulating these — strip them when you touch nearby code.
- **No "added for X" / "handles case from Y" comments.** Identifier names and structure should communicate this. If they don't, fix the naming before adding the comment.
- **One line max per inline comment.** No multi-paragraph rationale blocks above functions, no JSDoc-style narrative essays explaining the history of a fix. If you need more than one sentence, the function probably needs to be split or named better.
- **Strip diagnostic logs before commit.** Any `console.log('[handleApprove] firing…')` / `[advance] SKIPPED` / `[stepLifecycle] *done` line added while chasing a finding is diagnostic, not telemetry — remove it once the answer is in hand. Structural error-log lines (`logError`, `outputChannel.appendLine` inside catch blocks) stay; they're production-fit.

## Important Notes

1. **File Operations**: Use `vscode.Uri` and workspace-relative paths
2. **Tree Updates**: Call `refresh()` on providers after data changes
3. **Webview Communication**: Use `postMessage()` for extension ↔ webview messaging
4. **CSS Variables**: Webviews use VS Code theme variables (e.g., `--vscode-editor-background`)
5. **Context Menus**: Defined in `package.json` under `contributes.menus`
6. **Verify before fixing a backlog issue**: queued issues go stale — confirm the bug still reproduces on current `main` before building. Backlog tickets are frequently already-fixed by a later PR, a dup, or an already-correct path; close the dup or deliver only the genuinely-missing part rather than rebuilding what's there.
7. **Design tokens (`webview/styles/tokens.css`)**: readable content must use `--text-body` / `--text-primary`. `--text-secondary` / `--text-muted` map to VS Code's intentionally low-contrast `descriptionForeground` / `disabledForeground` (below WCAG AA on dark — they blend), so reserve them for true metadata. The secondary/muted tokens should derive from the theme foreground via `color-mix` rather than the raw VS Code description color (tracked in #254).

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

- **BDD style**: Use `describe`/`it` blocks that describe behavior, not implementation
- **VS Code mock**: Extension-side tests use `tests/__mocks__/vscode.ts` (mapped via `jest.config.js` `moduleNameMapper`). Add mock APIs there as needed.
- **Config**: Jest uses `ts-jest` with `tsconfig.test.json`
- **Known gap — config-dependent webview paths lack coverage**: components/providers that read live `vscode.workspace` config (e.g. `getWorkflows()`, the spec-editor turbo-pick dispatch) have no config-mock harness, so their gating/branch logic is review-only. This has recurred as a residual across #218/#234/#229 — adding a config-mock harness would let those branches get regression tests.

### Demo testing specs (fixed baseline — don't commit *test-time* edits)

`specs/_00_demo-specified/`, `specs/_01_demo-planned/`, and `specs/_02_demo-tasked/` are **committed manual-testing fixtures**, each pinned to one viewer state:

| Dir | State | Files present | Footer button it surfaces |
|-----|-------|---------------|---------------------------|
| `_00_demo-specified` | `specified` | `spec.md` | **Plan** |
| `_01_demo-planned` | `planned` | `spec.md`, `plan.md` | **Tasks** |
| `_02_demo-tasked` | `ready-to-implement` | `spec.md`, `plan.md`, `tasks.md` | **Implement** |

They exist so the viewer can be opened against a known state during development. Each baseline `.spec-context.json` uses the canonical `history[]` schema (a `start`+`complete` pair per step up to the spec's `currentStep`) — that's what makes `deriveViewerState`/`shouldShowApprove` surface the footer button. **Don't commit the *incidental* mutations you cause by exercising them** — clicking through the viewer rewrites `.spec-context.json`/files; `git restore` those, never `git add` them. **The exception is a deliberate baseline correction:** if you intentionally change what state a fixture represents (e.g. migrating it to a new schema), commit that. To restore the baseline after playing around: `git restore specs/_00_demo-specified specs/_01_demo-planned specs/_02_demo-tasked` (or `git checkout -- …`). Other `specs/_*/` dirs remain gitignored (local-only).

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

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure, shell commands, and other important information, read the current plan: `specs/137-complexity-fast-path/plan.md`
<!-- SPECKIT END -->
