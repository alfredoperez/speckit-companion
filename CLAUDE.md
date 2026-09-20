# CLAUDE.md

SpecKit Companion is a VS Code extension that gives AI assistants (terminal CLIs, IDE chat, the Claude Code panel) visual spec-driven development: specs (spec/plan/tasks), steering docs, and the Companion pipeline. The repo also ships a second, independently-versioned **spec-kit extension** under `apps/speckit-extension/`. Provider list: README "Supported AI Providers".

## Repo map

Three deliverables live under `apps/`: the VS Code extension (`apps/vscode/src/`, `apps/vscode/webview/`, its own `package.json`), the spec-kit extension (`apps/speckit-extension/`), and the marketing site (`apps/website/`).

- `capabilities/` — this repo's own living specs; it dogfoods the feature it ships.
- `specs/` — historical feature folders plus the pinned `_0N_demo-*` viewer fixtures.
- `docs/` — reference only, never the source of truth for behaviour.
- `apps/vscode/tests/` — integration, eval and shared fixtures, including the VS Code mock. Unit tests live in `__tests__` beside the code they cover.
- `assets/` — the mascot and social art. `content/media/` — the clips and renders the site and README serve. `tooling/scripts/` — the build and capture commands that produce them.
- `.github/`, `.specify/`, `.claude/`, `.agents/`, `.codex/`, `.storybook/`, `.vscode/` — committed dot-folders that are `specify init` output and manual-testing fixtures.
- `content/design/` — Pipeline Builder design-tool mockups (`*.dc.html` screens plus `canvas.json`), not a dot-folder or a fixture.
- `.serena/`, `.pytest_cache/`, and the per-agent command mirrors in `.gitignore` — local caches, not source.

The example apps and bench sandboxes that used to sit here now live in the sibling `speckit-bench` repo, which holds every app that tests and benchmarks need.

## Where things are documented

Read the matching doc instead of re-deriving from code:

- `docs/doc-sync.md` — **docs are part of the change, not a follow-up.** Which doc each area maps to, the feature → README section map, the per-release checklist, changelog voice. Consult before finishing any user-facing change.
- `docs/architecture.md` — structure and module map.
- `docs/capture-and-timing.md` + `docs/spec-context-schema.md` — how `.spec-context.json` gets captured, and its schema (read-then-merge writes; `transitions[]` is append-only).
- `docs/viewer-states.md`, `docs/template-profiles.md` — viewer state machine, pipeline/workflow presets. The sidebar, viewer, builder, configuration and provider references live on the site now, under `apps/website/src/content/docs/`.
- `docs/visual-assets.md`: how docs images and README GIFs are made and when to regenerate them. Everything in `docs/screenshots/generated/` is a build artifact of `tooling/scripts/capture-docs-images.mjs` (Storybook capture stories + Teamboard fixtures); the GIFs render from `content/media/feature-clips/` compositions. Any webview UI, styling, token, or fixture change makes them stale: regenerate, never hand-edit.
- `.claude/review-checklist.md` — webview/CSS correctness invariants review scans for (`.sr-only` vs `hidden`, ellipsis trio, Preact string styles, etc.).
- `apps/speckit-extension/docs/publishing.md` — spec-kit extension release flow.

## Gotchas

### Two extensions, two sets of docs

The two extensions each have their **own** README, CHANGELOG, version, release flow, and tag namespace: VS Code extension = root `README.md`/`CHANGELOG.md`, `package.json` `version`, `/publish` → `v*` tag; spec-kit extension = `apps/speckit-extension/README.md`/`CHANGELOG.md`, `extension.yml` `extension.version`, `/publish-speckit-ext` → `speckit-ext-v*` tag (`/publish-both` runs both). A change under `apps/speckit-extension/` updates **its** docs, never the root ones (and vice-versa); overlapping entries for a feature spanning both halves are expected. **Never edit `.specify/extensions/companion/CHANGELOG.md`** — generated, gitignored, overwritten on install. **The release flow owns the version bump — feature branches do not.** A branch touching `apps/speckit-extension/` writes under `## [Unreleased]` and leaves `extension.yml` `version`, the README badge, and `publishing.md` alone; bumping on a branch is what produces version/changelog/badge drift.

### `/releases/latest` resolves across both tag namespaces

Both products share one GitHub releases list, so `…/releases/latest` can return either — this bit the update checker (#274) and install URLs (#273). Guards: the update checker filters tags by `^v\d+\.\d+\.\d+$`, and the stable spec-kit-ext download lives behind the dedicated `companion-latest` prerelease tag. Never reintroduce a bare `/releases/latest` lookup.

### Screenshot filenames are load-bearing

README image URLs are absolute and pinned to `main` (`raw.githubusercontent.com/.../main/docs/screenshots/<file>`). The Marketplace serves the *last published* README but resolves images against *current* `main` — renaming or deleting a referenced screenshot retroactively 404s the published listing (this broke the v0.18.0 listing). Overwrite in place; never rename or delete.

### `escapeHtml` is safe for element content only

The webview's `escapeHtml` (textContent→innerHTML) does NOT escape attribute quotes, so user data inside `alt="${escapeHtml(x)}"` can break out and inject. Never interpolate user data into an HTML attribute via `innerHTML`; use DOM APIs (`createElement` + `textContent` + `setAttribute`).

### Extension isolation

The shipped extension is ONLY what's in the `.vsix`. `.claude/**`, `.specify/**` are user/workspace files — read-only from the extension's perspective; never implement extension features by modifying them. Extension-owned behavior lives in command handlers (`apps/vscode/src/features/specs/specCommands.ts`, viewer message handlers) or in the prompt text the extension builds (`ai-providers/*`). Exception: the committed `.specify/`, `.claude/`, `.codex/`, `.agents/skills/`, `.github/{agents,prompts}/speckit.*` dirs are **manual-testing fixtures** (`specify init` output) — don't delete them as an "isolation violation".

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
