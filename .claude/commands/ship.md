---
allowed-tools: Bash(git *), Bash(npm *), Bash(code --install-extension:*), Read, Glob, Grep
description: Review code, update docs, and package a new version (project)
---

## Context

- Current git status: !`git status --porcelain`
- Current version: !`node -p "require('./package.json').version"`
- Current branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -10`

## Your task

Help the user prepare and package a new version of the extension by:

### 1. Code Quality Review

Check for unwanted code patterns:
- Search for `TODO`, `FIXME`, `XXX` comments
- Search for `console.log`, `console.debug`, `debugger` statements
- Search for commented-out code blocks
- Flag any issues found and ask user if they should be addressed first

### 2. Documentation Check

Review if documentation needs updates:
- Check README.md for accuracy with current features
- Check CLAUDE.md for outdated instructions
- If recent commits touched UI or features, suggest documentation updates
- Ask user if any docs need updating before proceeding

### 3. Screenshot Check

If recent commits modified files in `webview/` or `src/features/`:
- Suggest the user may want to update screenshots
- List files in `docs/screenshots/` that might be outdated
- This is informational only - proceed regardless

### 4. Commit Changes

If there are uncommitted changes:
- Show a summary of what will be committed
- Ask user for a commit message
- Create the commit WITHOUT Claude Code attribution (no co-author, no generated-by footer)
- Format: Just the user's message, nothing else

### 5. Version Bump & Package

- Bump the patch version using `npm version patch --no-git-tag-version`
- Run `npm run compile` to ensure build succeeds
- Run `npm run package` to create the .vsix file
- Commit the version bump with message "chore: bump version to X.X.X"

### 6. Install Extension

- Install the new .vsix in VS Code using `code --install-extension speckit-companion-X.X.X.vsix`
- Report success with the installed version

Make sure to ask for user confirmation before creating commits. Handle errors gracefully.
