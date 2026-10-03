---
allowed-tools: Bash(git *), Bash(gh *), Bash(zip *), Bash(tar *), Bash(specify *), Bash(claude *), Bash(npm *), Bash(node:*), Bash(python3:*), Bash(cp *), Bash(rm *), Bash(mkdir *), Bash(sed *), Read, Edit, Write, AskUserQuestion
description: Publish every deliverable that changed, in one pass - the spec-kit extension, the VS Code extension, the Claude Code mod and the Copilot canvas
---

## Context

- Git status: !`git status --porcelain | head`
- Current branch: !`git branch --show-current`
- spec-kit ext version: !`grep -A4 '^extension:' apps/speckit-extension/extension.yml | grep 'version:' | tr -d ' "' | sed 's/version://'`
- VS Code ext version: !`node -p "require('./package.json').version"`
- Mod version: !`node -p "require('./apps/claude-mod/.claude-plugin/plugin.json').version"`
- Canvas version: !`node -p "require('./apps/copilot-canvas/plugin.json').version"`
- Latest `speckit-ext-v*` tag: !`git tag --list 'speckit-ext-v*' --sort=-version:refname | head -1`
- Latest `v*` tag: !`git tag --list 'v*' --sort=-version:refname | head -1`
- Latest `speckit-companion--v*` tag: !`git tag --list 'speckit-companion--v*' --sort=-version:refname | head -1`
- Latest `canvas-v*` tag: !`git tag --list 'canvas-v*' --sort=-version:refname | head -1`

## Your task

Release every deliverable in one pass. This command only orchestrates: each phase's steps live in its own command, which stays the single source of truth.

| Phase | Deliverable | Command | Tag | Where it lands |
|---|---|---|---|---|
| 1 | spec-kit extension | `.claude/commands/publish-speckit-ext.md` | `speckit-ext-v*` | GitHub release, `companion-latest` |
| 2 | VS Code extension | `.claude/commands/publish.md` | `v*` | Marketplace, through `release.yml` |
| 3 | Claude Code mod | `.claude/commands/publish-mod.md` | `speckit-companion--v*` | this repo's plugin marketplace |
| 4 | Copilot canvas | `.claude/commands/publish-canvas.md` | `canvas-v*` | pull request on github/awesome-copilot |

**The spec-kit extension goes before the VS Code extension, always.** The `.vsix` bundles `apps/speckit-extension/extension.yml` and compares it with the version installed in a user's project to say their spec-kit commands are out of date. Packaging the VS Code extension before the spec-kit bump ships a `.vsix` that expects the old version, so nobody hears about the new one until the next VS Code release. Packaging it against a version `companion-latest` does not serve yet tells every user to update to something the download does not have.

The mod and the canvas depend on neither. The canvas goes last because it is the only phase that waits on the user and leaves this repo, so nothing queues behind that pause.

### Steps

1. **Preflight.** Abort with a clear message if any fails:
   - The working tree is clean (`git status --porcelain` empty).
   - The branch is `main`.
   - QA gate: apply the Release gate in `.claude/commands/release-qa.md` (a `QA Report*.md` in the vault for the current HEAD with `verdict: ship` and no open FAIL). If it does not pass, stop and tell the user to run `/release-qa`; continue only on their explicit override. This is the only gate: the phases skip theirs.
2. **Find what changed** since each deliverable's last release:
   ```bash
   changed() { # changed <tag glob> <path>...
     local t; t=$(git tag --list "$1" --sort=-version:refname | head -1); shift
     [ -z "$t" ] && { echo "never released"; return; }
     git diff --quiet "$t" HEAD -- "$@" && echo "no changes since $t" || echo "changed since $t"
   }
   echo "spec-kit extension: $(changed 'speckit-ext-v*' apps/speckit-extension)"
   echo "VS Code extension:  $(changed 'v*' apps/vscode package.json README.md CHANGELOG.md)"
   echo "Claude Code mod:    $(changed 'speckit-companion--v*' apps/claude-mod .claude-plugin apps/copilot-canvas/spec-rules.mjs)"
   echo "Copilot canvas:     $(changed 'canvas-v*' apps/copilot-canvas)"
   ```
3. **Ask every target version in one question**, one line per deliverable with its current version and the step 2 result. Offer **skip** for a deliverable with no changes and recommend it; one that changed, or was never released, defaults to a release. A never-released mod or canvas may keep its current version. When the spec-kit extension is released and the user skips VS Code, say what that costs: the installed VS Code extension will not tell anyone about the new spec-kit version. Do not ask for a version again inside a phase.
4. **Phase 1, spec-kit extension.** Read `.claude/commands/publish-speckit-ext.md` and execute it exactly, with the version from step 3. It ends with the `speckit-ext-vX.Y.Z` release cut, `companion-latest/companion.zip` refreshed, and the scratch-dir install verified.
5. **Checkpoint.** Before any VS Code step, confirm all three, and **stop here** if any fails:
   - `main` is pulled and `apps/speckit-extension/extension.yml` reads the new version.
   - A scratch install from `…/releases/download/companion-latest/companion.zip` reports that same version.
   - `gh run list --workflow=release.yml --limit 2` shows no new run (both spec-kit tags are non-`v*`).
6. **Phase 2, VS Code extension.** Read `.claude/commands/publish.md` and execute its task section exactly, with the version from step 3. The `.vsix` it tags now bundles the manifest `companion-latest` serves. It ends with the `vX.Y.Z` tag pushed; confirm `release.yml` started for it.
7. **Phase 3, Claude Code mod.** Read `.claude/commands/publish-mod.md` and execute it exactly, with the version from step 3. It ends with the release commit on `main`, the `speckit-companion--vX.Y.Z` tag pushed, and the directory submission text printed for the user.
8. **Phase 4, Copilot canvas.** Read `.claude/commands/publish-canvas.md` and execute it exactly, with the version from step 3. Its stop before sending still applies: the approval that started this command is not a go for the pull request.
9. **No rollback.** A phase that fails stops the run, and everything released before it stays out: users already have it. Report what completed, what failed and what remains. The user finishes the rest later with each remaining phase's own command, in the same order.
10. **Final report**, one block per released deliverable and a line for each skipped one:
    - spec-kit extension: the tag, the release URL, the `specify extension add companion --from <url>` install command, and whether the catalog update was filed or deferred.
    - VS Code extension: the tag and the `release.yml` run status.
    - Claude Code mod: the tag, the `claude plugin marketplace add` and `claude plugin install` commands, and the directory submission text, marked as the user's to send.
    - Copilot canvas: the tag, the pull request URL and the state of its checks, or that the user declined to send it.

### Guardrails

- The four tag namespaces are disjoint and must stay that way. Only phase 2 creates a bare `v*` tag; any other phase creating one triggers a wrong Marketplace publish.
- Never run the VS Code phase before the spec-kit phase, not even to "get the Marketplace moving". The order is the fix for the out-of-date check, not a preference.
- Each phase commits only its own files: `apps/speckit-extension/`, the root version, changelog and READMEs, `apps/claude-mod/`, `apps/copilot-canvas/`. Never mix two in one commit.
- A skipped phase is skipped whole: no version bump, no tag, no commit.
