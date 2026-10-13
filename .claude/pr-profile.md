# PR profile — speckit-companion

PR-time distillation for the `create-pr` skill. **Source of truth = `CLAUDE.md`.** This repo ships **two independently-versioned, separately-released extensions**; a PR usually touches one.

## Conventional-commit scopes

`companion` · `speckit-ext` · `ai-providers` · `spec-viewer` · `spec-editor` · `sidebar` · `timing` · `capture` · `spec-context` · `workflow` · `settings` · `eval` · `bench` · `docs` · `gitignore`

Title rule: `type(scope): summary` — **issue refs go in the body (`Closes #N`), never the title.**

## Affected-area detection (path → area)

### VS Code extension (the GUI · `.vsix`)
Paths: `apps/vscode/src/**`, `apps/vscode/webview/**`, `package.json`, root `README.md`, root `CHANGELOG.md`, `assets/**`, `apps/vscode/tests/**`, `docs/**` (images), `CLAUDE.md`, `.vscodeignore`, `.storybook/**`
- **Version**: `package.json` `version` · **Release**: `/release-loop` (ends in `/publish`) → `v*` tag → Marketplace/OpenVSX
- Sub-areas to name in the checklist:
  - **settings** — `package.json` `contributes.configuration`
  - **commands / menus** — `package.json` `contributes.commands|menus|submenus`, `apps/vscode/src/features/specs/specCommands.ts`
  - **webview** — `apps/vscode/webview/**` (+ any sibling `*.stories.tsx` for changed components)
  - **dispatch / providers** — `apps/vscode/src/ai-providers/**`
  - **viewer / sidebar** — `apps/vscode/src/features/spec-viewer/**`, `apps/vscode/src/features/specs/specExplorerProvider.ts`
  - **version** — `package.json` `version` → ⚠️ **flag if bumped in a feature PR** (bumps belong to `/publish`, the last step of `/release-loop`)

### SpecKit extension (`id: companion` · spec-kit catalog)
Paths: `apps/speckit-extension/**`
- **Version**: `apps/speckit-extension/extension.yml` `extension.version` · **Release**: `/publish-speckit-ext` → `speckit-ext-v*` tag → catalog
- Sub-areas:
  - **commands** — `apps/speckit-extension/commands/**` (a new command must be in `extension.yml` `provides.commands` or the installer skips it → ⚠️ if missing)
  - **parts** — `apps/speckit-extension/presets/_parts/**` (shared build parts; rebuild, then run `python3 apps/speckit-extension/scripts/check_shape_parity.py`)
  - **scripts / hooks** — `apps/speckit-extension/scripts/**`
  - **version** — `extension.yml` `extension.version`

A change under `apps/speckit-extension/**` updates **its** README/CHANGELOG/version — **never** the root ones, and vice-versa.

## Changelog rule

- VS Code change → root `CHANGELOG.md`. SpecKit change → `apps/speckit-extension/CHANGELOG.md`.
- **Voice = user-facing release notes**: lead with the observable change; keep setting keys / command names / config files / install commands; **drop internal file & symbol names** (`promptBuilder.ts`, field names like `history[]`, function names). Test: would it land for someone who never opened `apps/vscode/src/`?
- A feature/bugfix that changes documented behavior is **⚠️ missing changelog** if no entry was added.
- **Never** edit `.specify/extensions/companion/CHANGELOG.md` — it's a generated copy, gitignored.

## Docs (one fact, one owner)

`CLAUDE.md` "One fact, one owner" is the rule: a fact lives on one surface, and a change updates that surface only. Flag ⚠️ when the diff changes a fact and its owner is not in the diff, and flag ⚠️ when the diff adds a second copy of a fact somewhere else.

- **Setting added, or a value's behaviour changed** → `package.json` description / `enumDescriptions` + the site's `reference/configuration.mdx`. Re-read both for "always", "never", "removes", "guarantees" against the new behaviour.
- **Provider added** → the `speckit.aiProvider` enum + the site's `reference/providers.mdx` (a test fails otherwise).
- **Something a user sees changed** → its one site page, and one `[Unreleased]` line in the changelog of the deliverable that changed.
- **Webview component with a sibling `*.stories.tsx`** → the stories.
- **A README** only when the install or the first run changed.

## Quality gates (PR-level)

- **No version bump** in a feature PR (version bumps ride `/publish` or `/publish-speckit-ext`, run by `/release-loop`) → ⚠️ if `package.json` or `extension.yml` version changed.
- **Extension isolation**: no new runtime dependence on `.claude/**` or `.specify/**` from `apps/vscode/src/` (those aren't shipped in the `.vsix`). Committed `.specify/`/`.cursor/`/`.windsurf/`/`.agents/`/`.gemini/`/`.qwen/`/`.github/{agents,prompts}/speckit.*` are IDE-chat test fixtures, not runtime deps.
- **Demo fixtures restored**: `specs/_00_demo-specified` / `_01_demo-planned` / `_02_demo-tasked` must be at their committed baseline (`git restore` test-time mutations) → ⚠️ if their `.spec-context.json` is dirtied.
- **Spec files included**: the PR's `specs/<NNN>-*/` artifacts and any modified `.spec-context.json` are committed; the spec's status is `completed` before merge (only `_NN_demo-*` fixtures stay active).
- **Screenshots** overwritten in place — never renamed/deleted (Marketplace serves absolute `raw.githubusercontent` URLs pinned to `main`).
- **No diagnostic logs** left in code (`console.log('[handleApprove] …')`); structural `logError`/catch-block logging stays.
- **Markdown**: no hard-wrapped paragraphs (one logical line per paragraph).

## Verify (typical commands)

`npm run compile` · `npm test` · `python3 apps/speckit-extension/scripts/check_shape_parity.py` (node or part changes) · `python3 apps/speckit-extension/scripts/check_capture.py specs/<NNN>-<slug>/` (capture/lifecycle changes).
