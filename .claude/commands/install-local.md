---
allowed-tools: Bash(npm version:*), Bash(npm run package:*), Bash(code --install-extension:*), Bash(code --command:*)
description: Bump version and install extension locally in VS Code
---

## Context

- Current version: !`node -p "require('./package.json').version"`

## Your task

Install the extension locally by:

1. Bump the patch version: `npm version patch --no-git-tag-version`
2. Package the extension: `npm run package`
3. Install in VS Code: `code --install-extension speckit-companion-{version}.vsix --force`
4. Reload VS Code window: `code --command workbench.action.reloadWindow`
5. Report the new version installed
