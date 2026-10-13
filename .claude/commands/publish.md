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

> **Scope: the VS Code extension only.** For the **spec-kit extension** (`apps/speckit-extension/`) use `/publish-speckit-ext` — it has its own README/CHANGELOG/`extension.yml` version and a `speckit-ext-v*` tag (a `v*` tag here would wrongly publish to the Marketplace). The Claude Code mod and the Copilot canvas ship with `/publish-mod` and `/publish-canvas`; `/publish-all` runs every flow in order.

Help the user publish a new version of the extension by:

0. QA gate. Apply the Release gate in `.claude/commands/release-qa.md` before anything else: a `QA Report*.md` in the vault for the current HEAD with `verdict: ship` and no open FAIL. If it does not pass, stop and tell the user to run `/release-qa`; continue only on their explicit override. Skip it when `/publish-all` already ran it in its preflight.
1. First check if there are uncommitted changes. If yes, abort with a warning.
2. Ask the user for the new version number (show current version).
3. Get the previous version tag and analyze commits since then to generate a changelog.
4. Update CHANGELOG.md by adding a new section at the top (after the header) with:
   - `## [X.X.X] - YYYY-MM-DD` format, then one plain lead sentence for the release
   - The format in `.claude/commands/changelog-entry.md` ("Changelog voice"): the big features under `### Highlights`, one `#### <Feature title>` block each with its `<!-- area: …; pr: …; media: … -->` comment, and every other entry as one bullet under Added / Fixed / Changed / Security ending with its full PR link and an `<!-- area: … -->` tag
   - `CHANGELOG.md` keeps `[Unreleased]` and the two latest releases. Cut every older release section and paste it at the top of `apps/website/src/data/changelog-archive.md`, above the newest one there, unchanged. A test fails when the changelog holds a third release.
5. Run the release checklist before anything is committed, and stop on a failure:
   - `npm run clips:check` must report 0 broken. A broken count is a 404 on the published Marketplace listing.
   - The README install and first-run steps still match what ships, and the README "VS Code" badge matches `engines.vscode` in `package.json`.
   - Re-render any screenshot whose UI changed in this release. Overwrite in place; never rename or delete a screenshot file.
   - Give each highlight its screenshots on the site's changelog. Name them in the highlight's comment (`media: builder-move-hook, builder-side-panel`) and add one entry per shot under the release's `vscode@<version>` key in `content/media/changelog.json`: `file` (a generated still under `docs/screenshots/generated/`, or a real-app screenshot copied to `apps/website/public/changelog/`), `alt`, a one-line `caption`, and a `highlight` box `{x, y, w, h}` in the image's own pixels when there is a clear changed area. Several shots make a carousel. Do it after the version heading exists.
   - The site builds: `cd apps/website && npm run build && npx astro check`. The build fails on a media id with no entry, a missing alt or file, a shot no highlight names, and a key that matches no release.
   - If the release touches `apps/speckit-extension/`, say so: the spec-kit extension ships separately with `/publish-speckit-ext`, and changes there (Auto folding, the writer) reach users only through it.
6. Update documentation files with the new version:
   - Update version references in README.md if it has any
7. Update package.json version using `npm version X.X.X --no-git-tag-version`.
8. Commit CHANGELOG.md, README.md, `content/media/changelog.json`, package.json and package-lock.json with message "chore: bump version to X.X.X".
9. Create an annotated tag `vX.X.X` with message "Release vX.X.X - See CHANGELOG.md for details".
10. Push both the commit and tag to origin.
11. Inform the user that GitHub Actions will handle the rest.

Make sure to handle errors gracefully and provide clear feedback at each step.