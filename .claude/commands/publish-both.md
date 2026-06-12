---
allowed-tools: Bash(git *), Bash(gh *), Bash(zip *), Bash(tar *), Bash(specify *), Bash(npm version:*), Bash(node:*), Bash(python3:*), Read, Edit, Write
description: Publish new versions of BOTH extensions (VS Code + spec-kit) back-to-back
---

## Context

- Git status: !`git status --porcelain | head`
- Current branch: !`git branch --show-current`
- VS Code ext version: !`node -p "require('./package.json').version"`
- spec-kit ext version: !`grep -A4 '^extension:' speckit-extension/extension.yml | grep 'version:' | tr -d ' "' | sed 's/version://'`
- Latest `v*` tags: !`git tag --list 'v*' --sort=-version:refname | grep -v speckit-ext | head -3`
- Latest `speckit-ext-v*` tags: !`git tag --list 'speckit-ext-v*' --sort=-version:refname | head -3`

## Your task

Release **both extensions in one pass** by running the two existing flows sequentially. This command adds orchestration only — the per-extension steps live in their own commands and stay the single source of truth:

- Phase 1 (VS Code extension): `.claude/commands/publish.md`
- Phase 2 (spec-kit extension): `.claude/commands/publish-speckit-ext.md`

### Steps

1. **Preflight** — abort with a clear message if either fails:
   - Working tree must be clean (`git status --porcelain` empty).
   - Branch must be `main`.
2. **Ask for both target versions up front** in a single question, showing both current versions. Do not ask again inside the phases.
3. **Phase 1 — VS Code extension.** Read `.claude/commands/publish.md` and execute its task section exactly, using the version from step 2 instead of prompting. Ends with the `vX.Y.Z` tag pushed and `release.yml` handling Marketplace/OpenVSX.
4. **Checkpoint.** Confirm `release.yml` started for the new `v*` tag (`gh run list --workflow=release.yml --limit 2`). If Phase 1 failed at any point, **stop here** — do not start Phase 2 on a half-released state.
5. **Phase 2 — spec-kit extension.** Read `.claude/commands/publish-speckit-ext.md` and execute it exactly, using the version from step 2 instead of prompting. Ends with the `speckit-ext-vX.Y.Z` GitHub release cut and the scratch-dir install verified.
6. **No rollback.** If Phase 2 fails, the VS Code release stays in flight (it's already on the Marketplace pipeline). Report precisely what completed, what failed, and what remains — the user finishes Phase 2 later with `/publish-speckit-ext`.
7. **Final report.** Both tags, the `release.yml` run status, the spec-kit release URL, and the `specify extension add companion --from <url>` install command.

### Guardrails

- The tag namespaces are disjoint and must stay that way: Phase 1 tags `v*`, Phase 2 tags `speckit-ext-v*`. Never let Phase 2 create a bare `v*` tag — that would trigger a second, wrong Marketplace publish.
- Each phase touches only its own version/CHANGELOG/README set (root files vs `speckit-extension/`). Never mix the two in one commit.
