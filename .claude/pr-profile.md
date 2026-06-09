# PR profile — speckit-companion

PR-time distillation for the `create-pr` skill. **Source of truth = `CLAUDE.md`** — keep this in sync when the two-extension split or docs rules change. This repo ships **two independently-versioned, separately-released extensions**; a PR usually touches one.

## Conventional-commit scopes

`companion` · `speckit-ext` · `ai-providers` · `spec-viewer` · `spec-editor` · `sidebar` · `timing` · `capture` · `spec-context` · `workflow` · `settings` · `eval` · `bench` · `docs` · `gitignore`

Title rule: `type(scope): summary` — **issue refs go in the body (`Closes #N`), never the title.**

## Affected-area detection (path → area)

### VS Code extension (the GUI · `.vsix`)
Paths: `src/**`, `webview/**`, `package.json`, root `README.md`, root `CHANGELOG.md`, `assets/**`, `tests/**`, `docs/**`, `CLAUDE.md`, `.vscodeignore`, `.storybook/**`
- **Version**: `package.json` `version` · **Release**: `/ship` or `/publish` → `v*` tag → Marketplace/OpenVSX
- Sub-areas to name in the checklist:
  - **settings** — `package.json` `contributes.configuration` (+ matching README Configuration section)
  - **commands / menus** — `package.json` `contributes.commands|menus|submenus`, `src/features/specs/specCommands.ts`
  - **webview** — `webview/**` (+ any sibling `*.stories.tsx` for changed components)
  - **dispatch / providers** — `src/ai-providers/**`
  - **viewer / sidebar** — `src/features/spec-viewer/**`, `src/features/specs/specExplorerProvider.ts`
  - **version** — `package.json` `version` → ⚠️ **flag if bumped in a feature PR** (bumps belong to `/ship`)

### SpecKit extension (`id: companion` · spec-kit catalog)
Paths: `speckit-extension/**`
- **Version**: `speckit-extension/extension.yml` `extension.version` · **Release**: `/publish-speckit-ext` → `speckit-ext-v*` tag → catalog
- Sub-areas:
  - **commands** — `speckit-extension/commands/**` (a new command must be in `extension.yml` `provides.commands` or the installer skips it → ⚠️ if missing)
  - **presets** — `speckit-extension/presets/**` (lean/standard bodies; run `python3 speckit-extension/scripts/check-shape-parity.py`)
  - **scripts / hooks** — `speckit-extension/scripts/**`
  - **version** — `extension.yml` `extension.version`

A change under `speckit-extension/**` updates **its** README/CHANGELOG/version — **never** the root ones, and vice-versa.

## Changelog rule

- VS Code change → root `CHANGELOG.md`. SpecKit change → `speckit-extension/CHANGELOG.md`.
- **Voice = user-facing release notes**: lead with the observable change; keep setting keys / command names / config files / install commands; **drop internal file & symbol names** (`promptBuilder.ts`, field names like `history[]`, function names). Test: would it land for someone who never opened `src/`?
- A feature/bugfix that changes documented behavior is **⚠️ missing changelog** if no entry was added.
- **Never** edit `.specify/extensions/companion/CHANGELOG.md` — it's a generated copy, gitignored.

## Docs map (change-type → required doc)

If the diff matches the left, the right-hand doc(s) **must** be in the diff too — else ⚠️:

| Change | Required doc |
|---|---|
| New/changed AI provider | README "Supported AI Providers" matrix + provider count + `package.json` `speckit.aiProvider` enum |
| New canonical workflow status | `docs/sidebar.md` badge tiers + README "Status vocabulary" |
| New/changed configuration setting | README "Configuration" section |
| Sidebar action / right-click menu | `docs/sidebar.md` + README "Sidebar at a Glance" |
| Viewer statuses / badges / buttons / step tabs | `docs/viewer-states.md` |
| Template profiles / preset reconciler / timing partial / `templateProfile` setting | `docs/template-profiles.md` |
| `.spec-context.json` capture / lifecycle hooks / `write-context.py` / timing | `docs/capture-and-timing.md` |
| Project structure / modules / architecture | `docs/architecture.md` |
| Webview component with a sibling `*.stories.tsx` | update the stories (or add one if a non-trivial component lacks it) |
| New workflow phase / sub-document type | README "Spec-Driven Phases" + Step Properties table |
| New platform / shell support | README "Platform Support" table |
| Bug fix changing documented behavior | the README section that documented it |
| Change under `speckit-extension/**` | `speckit-extension/README.md` + `speckit-extension/CHANGELOG.md` + `extension.yml` version |

## Setting-description sync (drift trap)

When you change what an existing setting **value does** (not just add a value), its description lives in a fixed set of places — reconcile **all** of them or a stale guarantee ships:
- `package.json` `enumDescriptions` (the settings-dropdown text)
- README "Configuration" — both the prose summary **and** the value-table row
- the setting's long-form doc (`docs/template-profiles.md`, etc.)
- `speckit-extension/README.md` if the value is named there

Re-check these red-flag words against the **new** behavior: "no … behavior", "plain upstream", "always", "never", "removes", "guarantees", "added". (This is exactly how `templateProfile: "off"` shipped a false "no Companion behavior" claim in four places after `off` stopped uninstalling `companion-standard` — the behavior changed, the descriptions didn't.)

## Quality gates (PR-level)

- **No version bump** in a feature PR (version bumps ride `/ship` or `/publish-speckit-ext`) → ⚠️ if `package.json` or `extension.yml` version changed.
- **Extension isolation**: no new runtime dependence on `.claude/**` or `.specify/**` from `src/` (those aren't shipped in the `.vsix`). Committed `.specify/`/`.cursor/`/`.windsurf/`/`.agents/`/`.gemini/`/`.qwen/`/`.github/{agents,prompts}/speckit.*` are IDE-chat test fixtures, not runtime deps.
- **Demo fixtures restored**: `specs/_00_demo-specified` / `_01_demo-planned` / `_02_demo-tasked` must be at their committed baseline (`git restore` test-time mutations) → ⚠️ if their `.spec-context.json` is dirtied.
- **Spec files included**: the PR's `specs/<NNN>-*/` artifacts and any modified `.spec-context.json` are committed; the spec's status is `completed` before merge (only `_NN_demo-*` fixtures stay active).
- **Screenshots** overwritten in place — never renamed/deleted (Marketplace serves absolute `raw.githubusercontent` URLs pinned to `main`).
- **No diagnostic logs** left in code (`console.log('[handleApprove] …')`); structural `logError`/catch-block logging stays.
- **Markdown**: no hard-wrapped paragraphs (one logical line per paragraph).

## Verify (typical commands)

`npm run compile` · `npm test` · `python3 speckit-extension/scripts/check-shape-parity.py` (preset changes) · `python3 .claude/skills/eval-speckit-extension/check_capture.py specs/<NNN>-<slug>/` (capture/lifecycle changes).
