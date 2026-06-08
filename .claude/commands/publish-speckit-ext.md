---
allowed-tools: Bash(git *), Bash(gh *), Bash(zip *), Bash(tar *), Bash(specify *), Bash(node:*), Bash(python3:*), Read, Edit
description: Release the spec-kit extension (companion) to a GitHub release for catalog/--from install
---

## Context

- spec-kit ext version: !`grep -A4 '^extension:' speckit-extension/extension.yml | grep 'version:' | tr -d ' "' | sed 's/version://'`
- Latest spec-kit-ext tags: !`git tag --list 'speckit-ext-v*' --sort=-version:refname | head -3`
- Git status: !`git status --porcelain | head`

## Your task

Release the **spec-kit extension** (`speckit-extension/`, `id: companion`) so people can install it without a local clone. This is **separate from `/publish`** (that's the VS Code extension → Marketplace). Full reference: `speckit-extension/docs/publishing.md`.

### ⚠️ Hard-won rules (do not skip)

1. **Tag namespace** — use a **prefixed** tag `speckit-ext-v<X.Y.Z>`. A bare `v*` tag triggers `release.yml` and would publish the WRONG thing to the VS Code Marketplace.
2. **Archive must be a `.zip`** (the installer rejects `.tar.gz` with `BadZipFile`), with a **single top-level dir** `companion-<X.Y.Z>/` containing `extension.yml` at its root (mirrors the GitHub source-archive layout the CLI expects).
3. **Every command must be registered** in `extension.yml` `provides.commands` — a command markdown that exists but isn't listed is silently skipped by the installer (this bit us once).
4. **Install command needs the name arg**: `specify extension add companion --from <https-url>` (not just `--from`). The URL must be **HTTPS**. A raw-URL install shows a one-time "untrusted source" prompt (expected until the catalog lists it).

### Steps

1. **Bump** `speckit-extension/extension.yml` `extension.version` (semver). Confirm the target version with the user.
2. **Update** `speckit-extension/CHANGELOG.md` — add a dated section for the new version; keep prior versions. End-user-friendly bullets.
3. **Readiness checklist** (the catalog guide's gates):
   - `id` lowercase-hyphen; `description` **< 100 chars**; `homepage` present; `license` field **and** a `LICENSE` file in `speckit-extension/`; `tags` 2–5.
   - **Every `provides.commands[].file` exists** AND every command markdown under `speckit-extension/commands/` is listed in `provides.commands`.
   - README is current (it's the catalog listing page).
4. **Commit + push** to `main` (`chore(speckit-ext): release v<X.Y.Z>`).
5. **Build the archive**:
   ```bash
   V=<X.Y.Z>
   rm -rf /tmp/cb && mkdir -p /tmp/cb/companion-$V
   ( cd speckit-extension && tar cf - --exclude=tests --exclude=assets . ) | ( cd /tmp/cb/companion-$V && tar xf - )
   ( cd /tmp/cb && zip -rq companion-$V.zip companion-$V )
   ```
6. **Cut the release** (prefixed tag, attach the zip):
   ```bash
   gh release create speckit-ext-v$V /tmp/cb/companion-$V.zip \
     --title "SpecKit Companion spec-kit extension v$V" \
     --notes-file <[X.Y.Z] section of speckit-extension/CHANGELOG.md> --target main
   ```
7. **Verify the deployed install** (simulate a user) in a scratch dir:
   ```bash
   mkdir -p /tmp/sk-verify/.specify/extensions && cd /tmp/sk-verify
   yes | specify extension add companion --from https://github.com/alfredoperez/speckit-companion/releases/download/speckit-ext-v$V/companion-$V.zip --force
   specify extension list   # → SpecKit Companion (vX.Y.Z), all commands listed
   ```
   - If a prior local install left **inconsistent emission dirs** (`.{claude,cursor,agents}/skills/speckit-companion-*`, `.{gemini,qwen}/commands/speckit.companion.*`, etc.), the install can throw `FileNotFoundError`. Nuke all companion emission artifacts first, then retry.
   - **Expected non-error output** (don't flag these as failures): a raw-URL install shows a one-time `⚠ Untrusted Source` prompt; a pre-existing install aborts with `already installed … retry with --force` (remove first or use `--force`); a stale `✗ companion (v0.1.0) ⚠️ Corrupted extension` must be removed before installing; and a clean install ends with an **informational** `⚠ Configuration may be required / Check: .specify/extensions/companion/` — no manual config is actually needed.
8. **Confirm** the prefixed tag did **not** trigger `release.yml`: `gh run list --workflow=release.yml --limit 2` (no new run).
9. **Report** the release URL + the install command. Remind that the by-name catalog install (`specify extension add companion`) needs the **Extension Submission issue** on github/spec-kit (see `publishing.md`) — that step is the user's call.

Update version references (README badge, `publishing.md`) to the new version. Never commit a VS Code `package.json` version bump as part of this.
