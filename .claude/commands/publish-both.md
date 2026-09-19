---
allowed-tools: Bash(git *), Bash(gh *), Bash(zip *), Bash(tar *), Bash(specify *), Bash(npm version:*), Bash(node:*), Bash(python3:*), Read, Edit, Write
description: Publish new versions of BOTH extensions (VS Code + spec-kit) back-to-back
---

## Context

- Git status: !`git status --porcelain | head`
- Current branch: !`git branch --show-current`
- VS Code ext version: !`node -p "require('./package.json').version"`
- spec-kit ext version: !`grep -A4 '^extension:' apps/speckit-extension/extension.yml | grep 'version:' | tr -d ' "' | sed 's/version://'`
- Latest `v*` tags: !`git tag --list 'v*' --sort=-version:refname | grep -v speckit-ext | head -3`
- Latest `speckit-ext-v*` tags: !`git tag --list 'speckit-ext-v*' --sort=-version:refname | head -3`

## Your task

Release **both extensions in one pass** by running the two existing flows sequentially. This command adds orchestration only — the per-extension steps live in their own commands and stay the single source of truth:

- Phase 1 (spec-kit extension): `.claude/commands/publish-speckit-ext.md`
- Phase 2 (VS Code extension): `.claude/commands/publish.md`

**The spec-kit extension goes first, always.** The `.vsix` bundles `apps/speckit-extension/extension.yml` and compares it with the version installed in a user's project to say their spec-kit commands are out of date. Packaging the VS Code extension before the spec-kit bump ships a `.vsix` that expects the old version, so nobody hears about the new one until the next VS Code release. Packaging it against a version `companion-latest` does not serve yet tells every user to update to something the download does not have.

### Steps

1. **Preflight** — abort with a clear message if either fails:
   - Working tree must be clean (`git status --porcelain` empty).
   - Branch must be `main`.
2. **Ask for both target versions up front** in a single question, showing both current versions. Do not ask again inside the phases.
3. **Phase 1 — spec-kit extension.** Read `.claude/commands/publish-speckit-ext.md` and execute it exactly, using the version from step 2 instead of prompting. Ends with the `speckit-ext-vX.Y.Z` release cut, `companion-latest/companion.zip` refreshed, and the scratch-dir install verified.
4. **Checkpoint.** Before any VS Code step, confirm all three, and **stop here** if any fails:
   - `main` is pulled and `apps/speckit-extension/extension.yml` reads the new version.
   - A scratch install from `…/releases/download/companion-latest/companion.zip` reports that same version.
   - `gh run list --workflow=release.yml --limit 2` shows no new run (both spec-kit tags are non-`v*`).
5. **Phase 2 — VS Code extension.** Read `.claude/commands/publish.md` and execute its task section exactly, using the version from step 2 instead of prompting. The `.vsix` it tags now bundles the manifest `companion-latest` serves. Ends with the `vX.Y.Z` tag pushed; confirm `release.yml` started for it.
6. **No rollback.** If Phase 2 fails, the spec-kit release stays out: users on the rolling URL already get it, and the only cost is that the installed VS Code extension does not nag them about it yet. Report what completed, what failed, and what remains — the user finishes Phase 2 later with `/publish`.
7. **Final report.** Both tags, the `release.yml` run status, the spec-kit release URL, the `specify extension add companion --from <url>` install command, and whether the catalog update was filed or deferred.

### Guardrails

- The tag namespaces are disjoint and must stay that way: the spec-kit phase tags `speckit-ext-v*`, the VS Code phase tags `v*`. Never let the spec-kit phase create a bare `v*` tag — that would trigger a wrong Marketplace publish.
- Never run the VS Code phase first, not even to "get the Marketplace moving". The order is the fix for the out-of-date check, not a preference.
- Each phase touches only its own version/CHANGELOG/README set (root files vs `apps/speckit-extension/`). Never mix the two in one commit.
