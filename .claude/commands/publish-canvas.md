---
allowed-tools: Bash(git *), Bash(gh *), Bash(npm *), Bash(node:*), Bash(mkdir *), Read, Edit, Write, AskUserQuestion
description: Release the GitHub Copilot app canvas (apps/copilot-canvas) by tagging it and pointing its github/awesome-copilot listing at the new commit
---

## Context

- Git status: !`git status --porcelain | head`
- Current branch: !`git branch --show-current`
- Canvas version: !`node -p "require('./apps/copilot-canvas/plugin.json').version"`
- Latest canvas tags: !`git tag --list 'canvas-v*' --sort=-version:refname | head -3`
- Our listing upstream: !`gh api repos/github/awesome-copilot/contents/plugins/external.json --jq .content | base64 -d | node -e "const e=JSON.parse(require('fs').readFileSync(0,'utf8')).find(p=>p.name==='speckit-companion');console.log(e?JSON.stringify(e.source)+' v'+e.version:'not listed')"`
- Our issues and pull requests upstream: !`gh search issues --repo github/awesome-copilot --author @me speckit-companion --limit 5`

## Your task

Release the **GitHub Copilot app canvas** (`apps/copilot-canvas/`). It is listed on [github/awesome-copilot](https://github.com/github/awesome-copilot) as an **external plugin**: the code stays in this repo, and their `plugins/external.json` names this repo, the path `apps/copilot-canvas`, a tag and a commit SHA. No file is copied into their repo. Their [contributing guide](https://github.com/github/awesome-copilot/blob/main/CONTRIBUTING.md#adding-external-plugins) sets the rules: read that section again on every run and follow it where it differs from this file.

The layout their checks read is `plugin.json` at the plugin root and the board in `com.github.copilot/extensions/speckit-companion/`, with `extension.mjs` at its root.

**Nothing leaves this machine before the user says go.** Steps 1 to 4 are local. The pushes and the submission are step 6.

### Steps

0. **QA gate.** Apply the Release gate in `.claude/commands/release-qa.md`. If it does not pass, stop and tell the user to run `/release-qa`; continue only on their explicit override. Skip it when `/publish-all` already ran it in its preflight.
1. **Preflight.** The working tree is clean and the branch is `main`, or abort.
2. **Version.** Ask for the new version, showing the current one; a first listing may keep it. Skip the question when `/publish-all` passed one in. Their site lists the `version`, so an update with the old number looks like no update.
3. **Bump and build.** Set `version` in `apps/copilot-canvas/plugin.json` and `apps/copilot-canvas/package.json`, run `npm run test:canvas` (it rebuilds `vendor/` first), and commit `apps/copilot-canvas/` locally as `chore(canvas): release v<X.Y.Z>`. Do not push yet.
4. **Check the layout** their canvas gate reads, at the commit about to be tagged:
   ```bash
   P=apps/copilot-canvas
   git cat-file -e "HEAD:$P/plugin.json" && git cat-file -e "HEAD:$P/com.github.copilot/extensions/speckit-companion/extension.mjs" && git cat-file -e "HEAD:$P/assets/preview.png" && echo layout ok
   git grep -n -E "from '\.\./|import\('\.\./" HEAD -- "$P/com.github.copilot" ; echo "(no line above: the board imports nothing outside its folder)"
   ```
   Their gate fails a board that imports a file outside its own folder, so a hit on the second line is fixed here first.
5. **Show and wait.** Show the user what will be sent: the version, the tag `canvas-v<X.Y.Z>`, the SHA of the release commit, and either the filled issue form (first listing) or the `plugins/external.json` diff (update). Then stop until the user answers with an explicit go. A go from earlier in the conversation, or one given to `/publish-all` for the release as a whole, does not count.
6. **Send**, only after the go:
   ```bash
   V=<X.Y.Z>
   git push origin main
   git tag -a "canvas-v$V" -m "Copilot canvas v$V" && git push origin "canvas-v$V"
   SHA=$(git rev-parse "canvas-v$V^{commit}")
   ```
   - **Not listed yet:** open their [external plugin issue form](https://github.com/github/awesome-copilot/issues/new?template=external-plugin.yml) with the name `speckit-companion`, the description from `plugin.json`, the repository `alfredoperez/speckit-companion`, the path `apps/copilot-canvas`, the ref `canvas-v$V`, the SHA, the version, `MIT`, the author, the homepage and the keywords from `plugin.json` (`canvas` must be one). A pull request that adds a new entry to `plugins/external.json` is rejected: the form is the only way in. Their bots answer on the issue; after a fix here, tag again and comment `/rerun-intake`.
   - **Already listed:** an update is a pull request that edits our entry in `plugins/external.json`: `version`, `source.ref` and `source.sha`, nothing else. Branch from their `main` in the checkout under the sandbox root (`. .claude/sandboxes-env.sh`, then `$SANDBOXES_DIR/awesome-copilot`), run their `npm ci && npm start` so the generated files follow, push to the fork and open the pull request titled `Update SpecKit Companion canvas to v<X.Y.Z>`.
7. **Report** the issue or pull request URL, the `canvas-v<X.Y.Z>` tag and SHA, the labels their bots set (`ready-for-review` or `requires-submitter-fixes`), and how people install it once listed: from **Customize → Canvas** in the Copilot app.

### Guardrails

- If the user declines at step 5, the release commit stays local and unpushed. Say so, and leave it for them to push or drop.
- The only tag this command creates is `canvas-v*`. A bare `v*` tag publishes the VS Code extension to the Marketplace.
- A pushed `canvas-v*` tag is never moved: their listing pins it. A fix gets a new version and a new tag.
- `assets/preview.png` keeps that exact name and path: `plugin.json` names it as the logo, and it is the listing card.
- Approval is theirs. Never ping a maintainer, and never approve, merge or close anything upstream.
