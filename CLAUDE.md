# CLAUDE.md

SpecKit Companion is a VS Code extension that gives AI assistants (terminal CLIs, IDE chat, the Claude Code panel) visual spec-driven development: specs (spec/plan/tasks), steering docs, and the Companion pipeline. The repo also ships a second, independently-versioned **spec-kit extension** under `speckit-extension/`. Provider list: README "Supported AI Providers".

## Where things are documented

Read the matching doc instead of re-deriving from code:

- `docs/doc-sync.md` — **docs are part of the change, not a follow-up.** Which doc each area maps to, the feature → README section map, the per-release checklist, changelog voice. Consult before finishing any user-facing change.
- `docs/architecture.md` — structure and module map.
- `docs/capture-and-timing.md` + `docs/spec-context-schema.md` — how `.spec-context.json` gets captured, and its schema (read-then-merge writes; `transitions[]` is append-only).
- `docs/viewer-states.md`, `docs/sidebar.md`, `docs/template-profiles.md` — viewer state machine, sidebar reference, pipeline/workflow presets.
- `.claude/review-checklist.md` — webview/CSS correctness invariants review scans for (`.sr-only` vs `hidden`, ellipsis trio, Preact string styles, etc.).
- `speckit-extension/docs/publishing.md` — spec-kit extension release flow.

## Gotchas

### Two extensions, two sets of docs

The two extensions each have their **own** README, CHANGELOG, version, release flow, and tag namespace: VS Code extension = root `README.md`/`CHANGELOG.md`, `package.json` `version`, `/publish` → `v*` tag; spec-kit extension = `speckit-extension/README.md`/`CHANGELOG.md`, `extension.yml` `extension.version`, `/publish-speckit-ext` → `speckit-ext-v*` tag (`/publish-both` runs both). A change under `speckit-extension/` updates **its** docs, never the root ones (and vice-versa); overlapping entries for a feature spanning both halves are expected. **Never edit `.specify/extensions/companion/CHANGELOG.md`** — generated, gitignored, overwritten on install. **The release flow owns the version bump — feature branches do not.** A branch touching `speckit-extension/` writes under `## [Unreleased]` and leaves `extension.yml` `version`, the README badge, and `publishing.md` alone; bumping on a branch is what produces version/changelog/badge drift.

### `/releases/latest` resolves across both tag namespaces

Both products share one GitHub releases list, so `…/releases/latest` can return either — this bit the update checker (#274) and install URLs (#273). Guards: the update checker filters tags by `^v\d+\.\d+\.\d+$`, and the stable spec-kit-ext download lives behind the dedicated `companion-latest` prerelease tag. Never reintroduce a bare `/releases/latest` lookup.

### Screenshot filenames are load-bearing

README image URLs are absolute and pinned to `main` (`raw.githubusercontent.com/.../main/docs/screenshots/<file>`). The Marketplace serves the *last published* README but resolves images against *current* `main` — renaming or deleting a referenced screenshot retroactively 404s the published listing (this broke the v0.18.0 listing). Overwrite in place; never rename or delete.

### `escapeHtml` is safe for element content only

The webview's `escapeHtml` (textContent→innerHTML) does NOT escape attribute quotes, so user data inside `alt="${escapeHtml(x)}"` can break out and inject. Never interpolate user data into an HTML attribute via `innerHTML`; use DOM APIs (`createElement` + `textContent` + `setAttribute`).

### Extension isolation

The shipped extension is ONLY what's in the `.vsix`. `.claude/**`, `.specify/**` are user/workspace files — read-only from the extension's perspective; never implement extension features by modifying them. Extension-owned behavior lives in command handlers (`src/features/specs/specCommands.ts`, viewer message handlers) or in the prompt text the extension builds (`ai-providers/*`). Exception: the committed `.specify/`, `.claude/`, `.codex/`, `.agents/skills/`, `.github/{agents,prompts}/speckit.*` dirs are **manual-testing fixtures** (`specify init` output) — don't delete them as an "isolation violation".

### Demo spec fixtures are a pinned baseline

`specs/_00…_03_demo-*` are committed fixtures, each pinned to one viewer state. Clicking through the viewer mutates their `.spec-context.json` — `git restore` those changes, never commit them (deliberate baseline migrations are the exception). Other `specs/_*/` dirs are gitignored.

## Conventions

- **No hard-wrapped paragraphs** in any `.md` file — one logical line per paragraph.
- **Comments: default none**, one line max, no spec/PR identifiers (`// per PR #182`); strip diagnostic `console.log`s before commit.
- **Verify a backlog issue still reproduces on `main` before fixing** — queued issues are frequently already fixed or dups.
- Design tokens: readable content uses `--text-body`/`--text-primary`; `--text-secondary`/`--text-muted` are below WCAG AA on dark — metadata only (#254).
- Tests: BDD `describe`/`it`; VS Code API mocked at `tests/__mocks__/vscode.ts` — extend it there. Known gap: config-dependent webview paths have no config-mock harness.
- Run the extension: F5 → Extension Development Host.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure, shell commands, and other important information, read the current plan: `specs/172-composable-command-nodes/plan.md`
<!-- SPECKIT END -->
