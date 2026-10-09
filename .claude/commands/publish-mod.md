---
allowed-tools: Bash(git *), Bash(gh *), Bash(claude *), Bash(npm run:*), Bash(node:*), Bash(tooling/scripts/sync-mod-mirror.sh:*), Read, Edit, AskUserQuestion
description: Release the Claude Code mod (apps/claude-mod) through this repo's plugin marketplace, and prepare the Anthropic directory submission for the user to send
---

## Context

- Git status: !`git status --porcelain | head`
- Current branch: !`git branch --show-current`
- Mod version: !`node -p "require('./apps/claude-mod/.claude-plugin/plugin.json').version"`
- Latest mod tags: !`git tag --list 'speckit-companion--v*' --sort=-version:refname | head -3`
- Claude Code version: !`claude --version`

## Your task

Release the **Claude Code mod** (`apps/claude-mod/`, plugin `speckit-companion`). It has no store upload: the repo-root `.claude-plugin/marketplace.json` lists it, so it is published the moment the release commit is on `main`. Reference: https://code.claude.com/docs/en/plugins/publish.

**The version bump is the release.** `claude plugin update` compares the `version` in `apps/claude-mod/.claude-plugin/plugin.json` with the installed one, so commits pushed without a new version reach nobody.

### Steps

0. **QA gate.** Apply the Release gate in `.claude/commands/release-qa.md`. If it does not pass, stop and tell the user to run `/release-qa`; continue only on their explicit override. Skip it when `/publish-all` already ran it in its preflight.
1. **Preflight.** The working tree is clean and the branch is `main`, or abort.
2. **Version.** Ask for the new version, showing the current one; a first release, with no tag yet, may keep it. Skip the question when `/publish-all` passed one in.
3. **Bump** `version` in `apps/claude-mod/.claude-plugin/plugin.json`. Never rename the plugin: installs are recorded as `speckit-companion@speckit-companion`, and a rename orphans every one of them.
4. **Rebuild the vendored bundle**: `npm run mod:build`. It regenerates `hooks/vendor/` from the canvas's `spec-rules.mjs` and the test fixtures from the demo specs.
5. **Validate and test**, and stop on the first failure:
   ```bash
   claude plugin validate --strict ./apps/claude-mod
   claude plugin validate --strict .
   claude plugin validate --strict apps/website/public/plugins/marketplace.json
   npm run test:mod
   ```
   The second line checks the repo's marketplace file and the third the hosted one, `apps/website/public/plugins/marketplace.json`, which is the file the install command points at. The hosted file is part of the release: it fetches the mod from `apps/claude-mod` on `main`, keeps the same entry text as the repo's file, and a change to it goes live with the next site deploy. `test:mod` also rebuilds the canvas bundle; if that leaves a diff under `apps/copilot-canvas/vendor`, `main` was stale, so stop and fix that first.
6. **README.** When the tests ran on a newer Claude Code than the "Tested on Claude Code" line in `apps/claude-mod/README.md` names, update that line.
7. **Commit and push** `apps/claude-mod/` to `main` as `chore(claude-mod): release v<X.Y.Z>`. Nothing else goes in this commit.
8. **Tag**: `claude plugin tag apps/claude-mod --push`. It checks that `plugin.json` and the marketplace entry agree, then creates and pushes `speckit-companion--v<X.Y.Z>`. Confirm with `gh run list --workflow=release.yml --limit 2` that no run started: the tag does not match `v*`.
9. **Report** the tag and the commands users run:
   ```bash
   claude plugin marketplace add https://speckit-companion.dev/plugins/marketplace.json
   claude plugin install speckit-companion@speckit-companion
   ```
   People who already have it run `claude plugin update speckit-companion@speckit-companion`, since auto-update is off by default for a third-party marketplace.
10. **Directory mirror.** Anthropic's directory reads a small mirror repo, `alfredoperez/speckit-companion-claude-mod`, because this repo is over its 50 MiB limit. Run `tooling/scripts/sync-mod-mirror.sh --push`: it copies the released mod, validates it and pushes, and the directory picks the new version up from that repo's `main`. The listing is managed at https://claude.ai/directory/manage; a version held for review is the user's to follow there. Never open the portal or submit on their behalf without being asked.
11. **Before a first listing anywhere else**, read the destination's own checklist and run its validator before sending. The directory's is https://claude.com/docs/plugins/pre-submission-checklist: a square PNG icon at `.claude-plugin/icon.png`, and a README that says what the mod reads, runs and sends.

### Guardrails

- The only tag this command creates is `speckit-companion--v*`. A bare `v*` tag publishes the VS Code extension to the Marketplace.
- Never edit `hooks/vendor/` or `tests/fixtures/` by hand; `npm run mod:build` owns both.
- A failure after the push leaves the release out: users can already install it. Report what is missing (usually the tag) and finish it by hand, never by reverting.
