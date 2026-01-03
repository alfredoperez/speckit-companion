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

Help the user prepare and package a new version of the extension.

**Note:** Arguments passed to this command are optional context/description (e.g., "refactoring and cleanup"). They are NOT the commit message or version number - those will be determined during the process.

Steps:

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
- Suggest a commit message using **conventional commit format**:
  - `feat:` - New feature
  - `fix:` - Bug fix
  - `refactor:` - Code refactoring (no functional change)
  - `docs:` - Documentation only
  - `chore:` - Maintenance tasks
  - `style:` - Formatting, whitespace
- Include a body with bullet points for significant changes
- Ask user to confirm or modify the commit message
- Create the commit WITHOUT Claude Code attribution (no co-author, no generated-by footer)

### 5. Update Changelog

**IMPORTANT: Always update the changelog before releasing!**

- Read CHANGELOG.md to see the current format and last entry
- Add a new entry at the top for the new version
- Format:
  ```markdown
  ## [X.X.X] - YYYY-MM-DD

  ### New Features
  - Feature description

  ### Improvements
  - Improvement description

  ### Fixed
  - Fix description
  ```
- **Keep entries end-user friendly** - Focus on what changed for users, not implementation details
  - Good: "Internal refactoring for better code maintainability"
  - Bad: "Migrate all 7 providers to use BaseTreeDataProvider abstract class"
- Base the entry on the commit message from step 4 and any recent commits
- Ask user to confirm the changelog entry before proceeding

### 6. Version Bump & Package

- Bump the patch version using `npm version patch --no-git-tag-version`
- Run `npm run compile` to ensure build succeeds
- Run `npm run package` to create the .vsix file
- Commit the version bump with message "chore: bump version to X.X.X"

### 7. Install Extension

- Install the new .vsix in VS Code using `code --install-extension speckit-companion-X.X.X.vsix`
- Report success with the installed version

### 8. Tag & Push

**If on a feature branch:**
- Ask user if they want to merge to main and create a release tag
- If yes:
  - `git checkout main`
  - `git merge <feature-branch> --no-edit`
  - `git tag -a vX.X.X -m "<commit message from step 4>"`
  - `git push origin main`
  - `git push origin vX.X.X`

**If already on main:**
- Ask user if they want to create a release tag and push
- If yes:
  - `git tag -a vX.X.X -m "<commit message from step 4>"`
  - `git push origin main`
  - `git push origin vX.X.X`

- Report the tag URL: `https://github.com/alfredoperez/speckit-companion/releases/tag/vX.X.X`

Make sure to ask for user confirmation before creating commits. Handle errors gracefully.
