# CLAUDE.md

SpecKit Companion is a VS Code extension that gives AI assistants (terminal CLIs, IDE chat, the Claude Code panel) visual spec-driven development: specs (spec/plan/tasks), steering docs, and the Companion pipeline. The repo also ships a second, independently-versioned **spec-kit extension** under `apps/speckit-extension/`. Provider list: the `speckit.aiProvider` enum in `package.json`.

## Repo map

Five deliverables live under `apps/`: the VS Code extension (`apps/vscode/src/`, `apps/vscode/webview/`, its own `package.json`), the spec-kit extension (`apps/speckit-extension/`), the GitHub Copilot app canvas (`apps/copilot-canvas/`, loaded in this repo through `.github/extensions/speckit-companion/`), the Claude Code mod (`apps/claude-mod/`, listed by the repo-root `.claude-plugin/marketplace.json`; its `hooks/vendor/` is bundled from the canvas's `spec-rules.mjs` by `npm run mod:build`), and the marketing site (`apps/website/`).

- `specs/` — historical feature folders plus the pinned `_0N_demo-*` viewer fixtures.
- `docs/` — images only: the screenshots the READMEs and the site load, the architecture diagram, the walkthrough video. No prose lives here; a test fails on a new markdown file.
- `apps/vscode/tests/` — integration, eval and shared fixtures, including the VS Code mock. Unit tests live in `__tests__` beside the code they cover.
- `assets/` — the mascot and social art. `content/media/` — the clips and renders the site and README serve. `tooling/scripts/` — the build and capture commands that produce them.
- `.github/`, `.specify/`, `.claude/`, `.agents/`, `.codex/`, `.storybook/`, `.vscode/` — committed dot-folders that are `specify init` output and manual-testing fixtures.
- `content/design/` — Workflow Builder design-tool mockups (`*.dc.html` screens plus `canvas.json`), not a dot-folder or a fixture.
- `.serena/`, `.pytest_cache/`, and the per-agent command mirrors in `.gitignore` — local caches, not source.

The example apps and bench sandboxes that used to sit here now live in the sibling `speckit-sandboxes` repo: one recipe per reusable test sandbox (`/sandbox` builds one), the seed apps they start from, the benchmark harness in its bench folder, and kept run results in its evidence folder. `.claude/sandboxes-env.sh` is the one place that knows where that checkout is; commands and scripts source it and never spell the path out.

## Where things are documented

Behaviour is documented by the code and its tests first. User-facing reference lives on the site, under `apps/website/src/content/docs/`. Everything else is one of these:

- "Architecture rules" below — the cross-module rules the code cannot show.
- `.claude/skills/feature-clip/` — how every generated image, GIF and web clip is made, and what a feature owes the media manifest. Regenerate with `npm run clips:capture` on any webview UI, styling, token or fixture change; never hand-edit a generated file.
- `.claude/skills/shots/` — screenshots and recordings of the real product, and the real-window and terminal checks.
- `.claude/commands/changelog-entry.md` — the changelog voice and the shape of a release. `.claude/commands/publish.md` — the release checklist.
- `THEME.md` — the marketing look (the site's Constellation colours, type, mascot and motifs) for anything promotional; `DESIGN.md` — the viewer's tokens and the taste rules for figures and captures.
- `.claude/review-checklist.md` — webview/CSS correctness invariants review scans for (`.sr-only` vs `hidden`, ellipsis trio, Preact string styles, etc.).
- `apps/speckit-extension/docs/` — the spec-kit extension's own notes: `node-model.md` (how commands are built from nodes), `living-specs.md`, `publishing.md` (its release flow).
- `apps/vscode/docs/telemetry.md` and `apps/website/docs/analytics.md` — the event catalogs and how to read them in PostHog.

This repo does not keep living specs of its own; the feature it ships is unaffected.

## One fact, one owner

A fact is written once, on the surface this table names. Every other surface links to it and never restates it, so a change updates the owner and nothing else. A second copy is a bug: delete it, do not sync it.

| Fact | Owner |
|---|---|
| A setting, its values and its default | `package.json` `contributes.configuration`, shown to users on the site's `apps/website/src/content/docs/docs/reference/configuration.mdx` |
| The providers | the `speckit.aiProvider` enum, shown in the provider table on the same page; a test holds the two together |
| Install steps | the site's install page; a README carries its own install command and nothing about the other deliverables' |
| How a feature works for a user | its one page under `apps/website/src/content/docs/` |
| What changed for a user | one `[Unreleased]` line in the changelog of the deliverable that changed; site and docs changes get no line |
| A rule the code cannot show | this file |

A README is an intro, an install, a first run and a link to the site. It gets an edit when the install or the first run changes, not when a feature does.

A few changes carry a follow-on that is easy to miss:

- **Webview UI, styling, tokens, capture stories or fixtures** → `npm run clips:capture`, then commit what it regenerates, including `content/media/web/` (tracked on purpose: a deploy cannot rebuild it).
- **A webview component with a sibling `*.stories.tsx`** → update the stories in the same change.
- **`spec-rules.mjs` in the Copilot canvas** → `npm run mod:build` and commit the bundle the Claude Code mod reads.
- **A new command in `apps/speckit-extension/`** → add it to `extension.yml` `provides.commands`, or the installer skips it.
- **A new surface** (an app, a panel, a provider, a top-level feature path) → add its path glob to `.claude/skills/release-qa/surface-map.yml`.
- **The Get Started walkthrough** → keep its step copy consistent with `contributes.viewsWelcome`.

## Architecture rules

`docs/architecture/diagram.html` draws how a command travels (generated from the JSON beside it by archify; edit the JSON, never the HTML). These are the rules it cannot show.

- **The host owns the filesystem.** `apps/vscode/src/` reads and writes; the webview under `apps/vscode/webview/src/` gets state by `postMessage` and never touches a file.
- **`core/` imports nothing from `features/` or `ai-providers/`.** A test holds the two grandfathered files to an exact allowlist, so the list only shrinks.
- **Ask `getProjectRoot()` for the project folder.** Never read the first workspace folder; a test fails on a direct read.
- **`.spec-context.json` is the one store, and only writers that keep its guarantees touch it.** History only grows, writes merge, a status never moves backward, and one cross-process lock covers every writer. Deterministic writes come from the extension's buttons and the in-command hook scripts (`by: extension`); the assistant's journaling is best effort (`by: ai`).
- **A step closes itself as its last action.** Leaving the close to the hook that follows strands the step on a provider that can only print the hook for a person to run.
- **Everything a repository controls reaches a panel as text, never markup.** Document text, filenames, run-record notes and version strings go through `escapeHtml` for element content, DOM APIs for attributes and `safeUrl` for links, in the viewer, the editor and the builder alike. Fenced code and diagrams are escaped before highlighting sees them.
- **The pipeline's shape is derived once.** `apps/speckit-extension/scripts/pipeline-graph.py` resolves it with the same code the build uses, and the Workflow Builder reads that JSON. Do not write a second derivation in TypeScript.
- **A new capture script goes on two packing lists.** Add it to `RUNTIME_SCRIPTS` in `package-manifest.py` and give it a `!` rule in `.vscodeignore`, and import it by plain name; `package-manifest.py --check` fails when either list falls behind.
- **The Copilot canvas and the Claude Code mod share no code with `apps/vscode/`.** They read the same `.spec-context.json` contract through `spec-rules.mjs`. The mod only reads. The canvas writes the record only in a project without the Companion writer, plus the one missing step finish it appends when a turn ended with the document written.
- **Adding a provider** → implement `IAIProvider`, register it in `aiProviderFactory.ts`, add its `PROVIDER_PATHS` entry, add the enum value in `package.json`, add its row to the provider table on the site. Terminal CLIs extend `cliTerminalProvider.ts`; Gemini and Wibey stay outside it because both run interactively.
- **Retired, do not reintroduce:** the `templateProfile`, `turboWorkflowPicker` and `complexityFastPath` toggles and the `companion-turbo` preset. `speckit.companion.templateProfile` survives only in `apps/vscode/src/core/settingsMigration.ts`, to migrate old values.

## Gotchas

### Two extensions, two sets of docs

The two extensions each have their **own** README, CHANGELOG, version, release flow, and tag namespace: VS Code extension = root `README.md`/`CHANGELOG.md`, `package.json` `version`, `/publish` → `v*` tag; spec-kit extension = `apps/speckit-extension/README.md`/`CHANGELOG.md`, `extension.yml` `extension.version`, `/publish-speckit-ext` → `speckit-ext-v*` tag (`/publish-all` runs every deliverable's flow in the safe order, with `/publish-mod` for the Claude Code mod and `/publish-canvas` for the Copilot canvas; `/release-loop` runs the whole release, fixes through `/release-qa` to publish). A change under `apps/speckit-extension/` updates **its** docs, never the root ones (and vice-versa); overlapping entries for a feature spanning both halves are expected. **Never edit `.specify/extensions/companion/CHANGELOG.md`** — generated, gitignored, overwritten on install. **The release flow owns the version bump — feature branches do not.** A branch touching `apps/speckit-extension/` writes under `## [Unreleased]` and leaves `extension.yml` `version`, the README badge, and `publishing.md` alone; bumping on a branch is what produces version/changelog/badge drift.

### `/releases/latest` resolves across both tag namespaces

Both products share one GitHub releases list, so `…/releases/latest` can return either — this bit the update checker (#274) and install URLs (#273). Guards: the update checker filters tags by `^v\d+\.\d+\.\d+$`, and the stable spec-kit-ext download lives behind the dedicated `companion-latest` prerelease tag. Never reintroduce a bare `/releases/latest` lookup.

### Screenshot filenames are load-bearing

The root README writes relative image paths and `vsce` rewrites them to `raw.githubusercontent.com/.../main/docs/screenshots/<file>` when it packages; `apps/speckit-extension/README.md` writes that absolute form by hand, because the Spec Kit catalog renders it from `main`. Either way the Marketplace serves the *last published* README but resolves images against *current* `main` — renaming or deleting a referenced screenshot retroactively 404s the published listing (this broke the v0.18.0 listing). Overwrite in place; never rename or delete.

### `escapeHtml` is safe for element content only

The webview's `escapeHtml` (textContent→innerHTML) does NOT escape attribute quotes, so user data inside `alt="${escapeHtml(x)}"` can break out and inject. Never interpolate user data into an HTML attribute via `innerHTML`; use DOM APIs (`createElement` + `textContent` + `setAttribute`).

### Extension isolation

The shipped extension is ONLY what's in the `.vsix`. `.claude/**`, `.specify/**` are user/workspace files — read-only from the extension's perspective; never implement extension features by modifying them. Extension-owned behavior lives in command handlers (`apps/vscode/src/features/specs/specCommands.ts`, viewer message handlers) or in the prompt text the extension builds (`ai-providers/*`). Exception: the committed `.specify/`, `.claude/`, `.codex/`, `.agents/skills/`, `.github/{agents,prompts}/speckit.*` dirs are **manual-testing fixtures** (`specify init` output) — don't delete them as an "isolation violation". One deliberate exception: when a project still carries a leftover Companion preset, activation runs `specify preset remove <id>` once, and the CLI deletes that preset's folder under `.specify/presets/` and restores the stock `.claude/skills/speckit-*` bodies. Activation never adds a preset. The extension itself writes no files there.

### Demo spec fixtures are a pinned baseline

`specs/_00…_03_demo-*` are committed fixtures, each pinned to one viewer state. Clicking through the viewer mutates their `.spec-context.json` — `git restore` those changes, never commit them (deliberate baseline migrations are the exception). Other `specs/_*/` dirs are gitignored.

## Conventions

- **No hard-wrapped paragraphs** in any `.md` file — one logical line per paragraph.
- **Comments: default none**, one line max, no spec/PR identifiers (`// per PR #182`); strip diagnostic `console.log`s before commit.
- **Verify a backlog issue still reproduces on `main` before fixing** — queued issues are frequently already fixed or dups.
- Design tokens: readable content uses `--text-body`/`--text-primary`; `--text-secondary`/`--text-muted` are below WCAG AA on dark — metadata only (#254). The review hue marks, it does not fill: `--review` is for rules, borders and tints, and every purple *word* takes `--review-ink`, which is derived per theme.
- Tests: BDD `describe`/`it`; VS Code API mocked at `apps/vscode/tests/__mocks__/vscode.ts` — extend it there. Known gap: config-dependent webview paths have no config-mock harness.
- Run the extension: F5 → Extension Development Host.

The block below is regenerated by the plan command and names the most recent run's plan, which is history — the repo map above is what's current.
<!-- SPECKIT START -->
For additional context about technologies to be used, project structure, shell commands, and other important information, read the current plan: `specs/618-foundational-wave-fanout/plan.md`
<!-- SPECKIT END -->
