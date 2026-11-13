---
allowed-tools: Bash(git *), Bash(gh *), Bash(npx changeset *), Bash(npm run:*), Bash(npx jest:*), Bash(node:*), Read, Edit, AskUserQuestion
description: Release the speckit-viewer npm package (packages/viewer) from its pending changesets, through the provenance publish workflow
---

## Context

- Git status: !`git status --porcelain | head`
- Current branch: !`git branch --show-current`
- Viewer version: !`node -p "require('./packages/viewer/package.json').version"`
- Private: !`node -p "require('./packages/viewer/package.json').private === true"`
- Pending changesets: !`ls .changeset | grep -v config.json`
- Latest viewer tags: !`git tag --list 'speckit-viewer-v*' --sort=-version:refname | head -3`

## Your task

Release **speckit-viewer** (`packages/viewer/`) to npm. Nothing here publishes: the tag does, through `.github/workflows/publish-viewer.yml`, which builds, tests and runs `npm publish --provenance`.

### Steps

1. **Preflight.** The working tree is clean and the branch is `main`, or abort. With no pending changeset, stop: there is nothing to release.
2. **First release only.** While `packages/viewer/package.json` has `"private": true`, the package has never been published. Ask the user to confirm the name `speckit-viewer` and that the `NPM_TOKEN` secret is set; on a yes, remove `"private": true`. On anything else, stop.
3. **Version.** `npx changeset version`: it consumes the changesets, bumps `packages/viewer/package.json` and writes `packages/viewer/CHANGELOG.md`.
4. **Build and test**, and stop on the first failure: `npm run viewer:build` and `npx jest packages/viewer`.
5. **Commit and push** to `main` as `chore(viewer): release speckit-viewer v<X.Y.Z>`, with only `.changeset/` and `packages/viewer/` in it.
6. **Tag and push** `speckit-viewer-v<X.Y.Z>`. Report the run with `gh run list --workflow=publish-viewer.yml --limit 1` and confirm with `gh run list --workflow=release.yml --limit 2` that no extension release started.
7. **Report** the tag, the run URL and `npm install speckit-viewer@<X.Y.Z>`.

### Guardrails

- Never run `npm publish` or `changeset publish` locally: the workflow publishes, so every version carries provenance.
- The only tag this command creates is `speckit-viewer-v*`. A bare `v*` tag publishes the VS Code extension.
