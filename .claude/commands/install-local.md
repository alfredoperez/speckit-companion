---
allowed-tools: Bash(npm version:*), Bash(npm run package:*), Bash(code --install-extension:*), Bash(code --command:*), Bash(specify extension:*)
description: Bump version and install both extensions locally (VS Code + spec-kit)
---

## Context

- Current version: !`node -p "require('./package.json').version"`

## Your task

This repo ships **two** extensions: the **VS Code extension** (`.vsix`) and the **spec-kit extension** (`speckit-extension/` — the `/speckit.companion.*` commands + capture scripts). Reinstall both so local changes to either are picked up.

### 1. VS Code extension

1. Bump the patch version: `npm version patch --no-git-tag-version` (ALWAYS bump — VS Code ignores reinstalls at the same version)
2. Package the extension: `npm run package`
3. Install in VS Code: `code --install-extension speckit-companion-{version}.vsix --force`
4. Reload VS Code window: `code --command workbench.action.reloadWindow`

**Important:** Never skip the version bump. VS Code caches by version number, so same version = no update.

### 2. spec-kit extension (only if `speckit-extension/extension.yml` exists)

5. Reinstall it so changed/new commands + scripts are re-emitted to the agent dirs:
   `specify extension add ./speckit-extension --dev --force`
   - This regenerates `.specify/extensions/companion/` and the per-agent command emissions — all gitignored (source of truth is `speckit-extension/`), so it produces no commit churn.
   - If `specify` isn't installed or lacks the `extension` subcommand (stock PyPI build), skip with a note — see `speckit-extension/docs/install.md`.
6. Confirm the commands registered: `specify extension add` prints the provided commands; verify any you just changed (e.g. `speckit.companion.status` / `speckit.companion.resume`) appear.

### 3. Report

Report the new VS Code version installed **and** whether the spec-kit extension was reinstalled (with the command count), or why it was skipped.
