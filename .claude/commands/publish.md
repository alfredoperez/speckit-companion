---
allowed-tools: Bash(git *), Bash(npm version:*), Bash(node:*), Edit, Read, Write
description: Publish a new version of the extension
---

## Context

- Current git status: !`git status --porcelain`
- Current version: !`node -p "require('./package.json').version"`
- Current branch: !`git branch --show-current`
- Recent tags: !`git tag --sort=-version:refname | head -5`

## Your task

Help the user publish a new version of the extension by:

1. First check if there are uncommitted changes. If yes, abort with a warning.
2. Ask the user for the new version number (show current version).
3. Get the previous version tag and analyze commits since then to generate a changelog.
4. Update CHANGELOG.md by adding a new section at the top (after the header) with:
   - `## [X.X.X] - YYYY-MM-DD` format
   - Generated changelog with sections for New Features, Bug Fixes, and Improvements
   - Keep all previous versions' changelogs intact
5. Update documentation files with the new version:
   - Update version references in CLAUDE.md if needed
   - Update version references in README.md (e.g., in installation commands)
   - Update version references in README.zh-CN.md (e.g., in installation commands)
6. Update package.json version using `npm version X.X.X --no-git-tag-version`.
7. Commit CHANGELOG.md, CLAUDE.md, README.md, README.zh-CN.md, package.json and package-lock.json with message "chore: bump version to X.X.X".
8. Create an annotated tag `vX.X.X` with message "Release vX.X.X - See CHANGELOG.md for details".
9. Push both the commit and tag to origin.
10. Inform the user that GitHub Actions will handle the rest.

Make sure to handle errors gracefully and provide clear feedback at each step.