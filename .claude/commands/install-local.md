---
allowed-tools: Bash(npm version:*), Bash(npm run package:*), Bash(code --install-extension:*), Bash(code --command:*), Bash(specify extension:*)
description: Bump version and install both extensions locally (VS Code + spec-kit)
---

## Context

- Current version: !`node -p "require('./package.json').version"`

## Your task

This repo ships **two** extensions: the **VS Code extension** (`.vsix`) and the **spec-kit extension** (`speckit-extension/` — the `/speckit.companion.*` commands + capture scripts). Reinstall both so local changes to either are picked up.

### 1. VS Code extension

1. Bump to one patch **above both the repo version AND the highest already-installed version**. Throwaway local installs accumulate in `~/.vscode/extensions/` at versions *above* the git baseline (each `/install-local` bump is restored in git but the installed `.vsix` stays), so a plain `npm version patch` from the baseline can produce a version ≤ what's installed → VS Code sees nothing newer and shows **no reload banner**. Compute a safe target instead:

   ```bash
   INSTALLED=$(ls -d ~/.vscode/extensions/alfredoperez.speckit-companion-* 2>/dev/null \
     | sed -E 's/.*-([0-9]+\.[0-9]+\.[0-9]+)$/\1/' | sort -V | tail -1)
   REPO=$(node -p "require('./package.json').version")
   BASE=$(printf '%s\n%s\n' "$INSTALLED" "$REPO" | sort -V | tail -1)
   NEXT=$(node -e "const [a,b,c]=process.argv[1].split('.').map(Number);console.log([a,b,c+1].join('.'))" "$BASE")
   npm version "$NEXT" --no-git-tag-version
   ```

2. Package the extension: `npm run package`
3. Install in VS Code: `code --install-extension speckit-companion-{version}.vsix --force`
4. Reload: the new-higher version makes VS Code surface a **"Restart Extensions / Reload"** banner. `code --command workbench.action.reloadWindow` is NOT a supported CLI flag in current builds (it warns and no-ops) — don't rely on it; tell the user to click the banner or run **Developer: Reload Window** if it doesn't appear.

**Important:** Never skip the version bump, and never bump *below* an installed version — VS Code caches by version number, so same-or-lower = no update and no banner. After installing, restore the throwaway bump in git (`git restore package.json package-lock.json`) so it never lands in a feature commit.

### 2. spec-kit extension (only if `speckit-extension/extension.yml` exists)

5. Reinstall it so changed/new commands + scripts are re-emitted to the agent dirs:
   `specify extension add ./speckit-extension --dev --force`
   - This regenerates `.specify/extensions/companion/` and the per-agent command emissions — all gitignored (source of truth is `speckit-extension/`), so it produces no commit churn.
   - If `specify` isn't installed or lacks the `extension` subcommand (stock PyPI build), skip with a note — see `speckit-extension/docs/install.md`.
6. Confirm the commands registered: `specify extension add` prints the provided commands; verify any you just changed (e.g. `speckit.companion.status` / `speckit.companion.resume`) appear.

### 3. Report

Report the new VS Code version installed **and** whether the spec-kit extension was reinstalled (with the command count), or why it was skipped.
