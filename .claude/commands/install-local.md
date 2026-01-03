---
allowed-tools: Bash(npm version:*), Bash(npm run package:*), Bash(code --install-extension:*)
description: Bump version and install extension locally in VS Code
---

## Context

- Current version: !`node -p "require('./package.json').version"`

## Your task

Install the extension locally by:

1. Bump the patch version: `npm version patch --no-git-tag-version`
2. Package the extension: `npm run package`
3. Install in VS Code: `code --install-extension speckit-companion-{version}.vsix --force`
4. Report the new version installed
