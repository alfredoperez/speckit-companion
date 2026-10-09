---
allowed-tools: Bash(git *), Bash(gh *), Bash(npm *), Bash(node:*), Bash(cp *), Bash(rm *), Bash(mkdir *), Bash(sed *), Bash(pipx *), Read, Edit, Write, AskUserQuestion
description: Release the GitHub Copilot app canvas (apps/copilot-canvas) by validating it and opening or updating its pull request on github/awesome-copilot
---

## Context

- Git status: !`git status --porcelain | head`
- Current branch: !`git branch --show-current`
- Canvas version: !`node -p "require('./apps/copilot-canvas/plugin.json').version"`
- Latest canvas tags: !`git tag --list 'canvas-v*' --sort=-version:refname | head -3`
- Our pull requests upstream: !`gh pr list --repo github/awesome-copilot --author @me --state all --search speckit-companion --limit 3`

## Your task

Release the **GitHub Copilot app canvas** (`apps/copilot-canvas/`). It reaches users through a pull request to [github/awesome-copilot](https://github.com/github/awesome-copilot), whose [contributing guide](https://github.com/github/awesome-copilot/blob/main/CONTRIBUTING.md#adding-canvas-extensions) sets the layout: the source in `extensions/speckit-companion/` with `extension.mjs` at its root, and the listing in `plugins/speckit-companion/` as `plugin.json` plus a `README.md`. Read that section again on every run and follow it where it differs from this file.

**Nothing leaves this machine before the user says go.** Steps 1 to 6 are local. The pushes and the pull request are step 8.

### Steps

0. **QA gate.** Apply the Release gate in `.claude/commands/release-qa.md`. If it does not pass, stop and tell the user to run `/release-qa`; continue only on their explicit override. Skip it when `/publish-all` already ran it in its preflight.
1. **Preflight.** The working tree is clean and the branch is `main`, or abort.
2. **Version.** Ask for the new version, showing the current one; a first release, with no tag yet, may keep it. Skip the question when `/publish-all` passed one in. Their site lists the `version` in `plugin.json`, so an update with the old number looks like no update.
3. **Bump and build.** Set `version` in `apps/copilot-canvas/plugin.json` and `apps/copilot-canvas/package.json`, run `npm run test:canvas` (it rebuilds `vendor/` first), and commit `apps/copilot-canvas/` locally as `chore(canvas): release v<X.Y.Z>`. Do not push yet.
4. **Get a fresh upstream checkout.** Always branch from their `main`: a branch cut from `staged` carries generated plugin files and gets rejected. The checkout is a clone under the sandbox root (`$SANDBOXES_DIR/awesome-copilot`), made the first time this step runs and reused after.
   ```bash
   . .claude/sandboxes-env.sh
   AC="$SANDBOXES_DIR/awesome-copilot"
   [ -d "$AC/.git" ] || { mkdir -p "$SANDBOXES_DIR" && git clone https://github.com/github/awesome-copilot "$AC"; }
   git -C "$AC" fetch origin main
   git -C "$AC" checkout -B speckit-companion-canvas origin/main
   ```
5. **Sync.** Copy only what the canvas runs. The tests, `build.mjs` and `dev.mjs` stay here, because they read this repo's sources.
   ```bash
   SRC=apps/copilot-canvas
   EXT="$AC/extensions/speckit-companion"
   PLG="$AC/plugins/speckit-companion"
   REPO=https://github.com/alfredoperez/speckit-companion
   rm -rf "$EXT" "$PLG" && mkdir -p "$EXT" "$PLG"
   cp "$SRC"/*.mjs "$SRC/package.json" "$EXT/"
   rm "$EXT/build.mjs" "$EXT/dev.mjs"
   cp -R "$SRC/public" "$SRC/vendor" "$SRC/assets" "$EXT/"
   cp "$SRC/plugin.json" "$PLG/"
   sed -e "s#](\./assets/#]($REPO/raw/main/apps/copilot-canvas/assets/#g" \
       -e "s#](\.\./speckit-extension/#]($REPO/blob/main/apps/speckit-extension/#g" \
       "$SRC/README.md" > "$PLG/README.md"
   cp "$PLG/README.md" "$EXT/README.md"
   ```
   `AC` is not a fresh variable in a later Bash call: set it again with the first two lines of step 4.
   The `sed` turns the README's two relative links into absolute ones, since neither target exists in their repo. Never add a `canvas.json`.
6. **Validate with their validator, then regenerate their README**:
   ```bash
   cd "$AC" && npm ci && npm run plugin:validate && npm start
   pipx run codespell extensions/speckit-companion plugins/speckit-companion
   ```
   The last line is their spelling check, read from their `.codespellrc`; their CI fails the pull request on it, and it reads a short variable name in the bundled code as a typo. With no `pipx`, install `codespell` into a throwaway virtual environment and run that.
   Every error is fixed in `apps/copilot-canvas/` here, amended into the step 3 commit and synced again, never patched in the checkout. Their CI fails a pull request whose generated README is stale, so the files `npm start` changes go in the commit. Commit everything in the checkout as one commit.
7. **Show and wait.** Write the pull request text and show the user all of it: the title, the body, the base (`github/awesome-copilot` `main`), the head branch, and `git -C "$AC" diff --stat origin/main`. The title is `Add SpecKit Companion canvas extension` the first time and `Update SpecKit Companion canvas extension to v<X.Y.Z>` after. The body is plain prose: what the board does in two sentences, the two folders it adds or changes, that `npm run plugin:validate` and `npm start` ran clean, a link to the source folder in this repo, and on an update what changed since the listed version. Then stop until the user answers with an explicit go. A go from earlier in the conversation, or one given to `/publish-all` for the release as a whole, does not count.
8. **Send**, only after the go:
   ```bash
   V=<X.Y.Z>
   git push origin main
   git tag -a "canvas-v$V" -m "Copilot canvas v$V" && git push origin "canvas-v$V"
   gh repo fork github/awesome-copilot --clone=false
   git -C "$AC" push --force-with-lease "https://github.com/$(gh api user --jq .login)/awesome-copilot" speckit-companion-canvas
   ```
   When a pull request from `speckit-companion-canvas` is already open, the push updated it: edit its title and body with `gh pr edit`. Otherwise open one with `gh pr create --repo github/awesome-copilot --base main --head <login>:speckit-companion-canvas`. The `canvas-v*` tag marks what was sent, and `/publish-all` reads it to tell whether the canvas changed since.
9. **Report** the pull request URL, the `canvas-v<X.Y.Z>` tag, the state of their `submission-gate` check (`gh pr checks`), and how people install it once merged: from **Customize → Canvas** in the Copilot app. If the check asks for fixes, they go through this command again.

### Guardrails

- If the user declines at step 7, the release commit stays local and unpushed. Say so, and leave it for them to push or drop.
- The only tag this command creates is `canvas-v*`. A bare `v*` tag publishes the VS Code extension to the Marketplace.
- `assets/preview.png` keeps that exact name and path: their manifest requires it, and it is the listing card.
- Merging is theirs. Never ping a maintainer, and never merge or close anything upstream.
