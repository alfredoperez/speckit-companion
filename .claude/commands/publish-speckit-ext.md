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
5. **Build the archive** — **allow-list, runtime files only**. Copy just what the installed extension runs (manifest, dispatched commands, the workflow, the runtime scripts, license). Do NOT ship docs, CHANGELOG, ROADMAP, README, `examples/`, or the build-only `nodes/`+`presets/` sources — the catalog renders README/CHANGELOG from GitHub blob URLs, not the zip. (Don't "restore" a `tar --exclude` deny-list here: an allow-list is what keeps future doc/source additions out of the package.)
   ```bash
   V=<X.Y.Z>
   rm -rf /tmp/cb && mkdir -p /tmp/cb/companion-$V/scripts
   cd speckit-extension
   cp extension.yml LICENSE /tmp/cb/companion-$V/
   cp -R commands workflows /tmp/cb/companion-$V/
   python3 scripts/package-manifest.py --copy-to /tmp/cb/companion-$V/scripts
   cd - >/dev/null
   ( cd /tmp/cb && zip -rq companion-$V.zip companion-$V )
   ```
   **Never hand-type the script list here.** `package-manifest.py` is the single source of truth and `--copy-to` fills the archive from it (it re-runs the gate first and refuses to copy from a failing list). This step used to enumerate the scripts by hand — it drifted behind the commands, disagreed with the copy in `docs/publishing.md`, and shipped an archive missing five runtime scripts, which left the adoption, drift, and coverage commands unrunnable for every user who installed from a release (#432). If a command starts calling a new script, CI fails until the script is added to the manifest — there is nothing to update in this file.
6. **Cut the release** (prefixed tag, attach the version-named zip for archival):
   ```bash
   gh release create speckit-ext-v$V /tmp/cb/companion-$V.zip \
     --title "SpecKit Companion spec-kit extension v$V" \
     --notes-file <[X.Y.Z] section of speckit-extension/CHANGELOG.md> --target main
   ```
7. **Refresh the stable `companion-latest` asset** — this is what the README/install docs point users at, so the install/update URL never changes between releases. Force-replace the **stable-named** `companion.zip` on a reusable `companion-latest` **prerelease** with the *same* build:
   ```bash
   cp /tmp/cb/companion-$V.zip /tmp/cb/companion.zip
   if gh release view companion-latest >/dev/null 2>&1; then
     gh release upload companion-latest /tmp/cb/companion.zip --clobber
   else
     gh release create companion-latest /tmp/cb/companion.zip \
       --title "SpecKit Companion (latest)" \
       --notes 'Rolling stable download for the spec-kit extension. Always serves the newest `companion` build. Install/update: `specify extension add companion --from https://github.com/alfredoperez/speckit-companion/releases/download/companion-latest/companion.zip --force`' \
       --prerelease --target main
   fi
   gh release edit companion-latest --prerelease   # idempotent — re-asserts prerelease every run so a mis-marked prior release can't become /releases/latest
   ```
   - **`--prerelease` is mandatory.** It keeps `companion-latest` out of the repo's `/releases/latest` (which resolves across BOTH products — a `v*` VS Code release would otherwise hijack it). The stable URL `…/releases/download/companion-latest/companion.zip` resolves by **tag**, so it's immune to the `v*`/`speckit-ext-v*` interleaving. The trailing `gh release edit … --prerelease` re-asserts the flag on every run (the create path sets it, but an existing release that lost the flag would otherwise stay a normal release). Never document `…/releases/latest/download/…` for this repo.
   - The `companion-latest` tag is non-`v*`, so it does **not** trigger `release.yml` (the VS Code Marketplace publish).
8. **Verify the deployed install** (simulate a user) in a scratch dir — install from the **stable** URL, the same one users run:
   ```bash
   mkdir -p /tmp/sk-verify/.specify/extensions && cd /tmp/sk-verify
   yes | specify extension add companion --from https://github.com/alfredoperez/speckit-companion/releases/download/companion-latest/companion.zip --force
   specify extension list   # → SpecKit Companion (vX.Y.Z), all commands listed
   ```
   - If a prior local install left **inconsistent emission dirs** (`.{claude,cursor,agents}/skills/speckit-companion-*`, `.{gemini,qwen}/commands/speckit.companion.*`, etc.), the install can throw `FileNotFoundError`. Nuke all companion emission artifacts first, then retry.
   - **Expected non-error output** (don't flag these as failures): a raw-URL install shows a one-time `⚠ Untrusted Source` prompt; a pre-existing install aborts with `already installed … retry with --force` (remove first or use `--force`); a stale `✗ companion (v0.1.0) ⚠️ Corrupted extension` must be removed before installing; and a clean install ends with an **informational** `⚠ Configuration may be required / Check: .specify/extensions/companion/` — no manual config is actually needed.
9. **Confirm** neither the prefixed tag nor `companion-latest` triggered `release.yml`: `gh run list --workflow=release.yml --limit 2` (no new run — both tags are non-`v*`).
10. **Refresh the community-catalog entry** (only once the entry already exists upstream — first-time listing still goes through the Extension Submission issue). The catalog pins each entry to a version-specific asset, so a new release means the `companion` entry in `github/spec-kit` → `extensions/catalog.community.json` is now stale. Open/refresh a PR from the fork (`alfredoperez/spec-kit`) that bumps the entry to **this** release:
    - `version` → `$V`
    - `download_url` → `…/releases/download/speckit-ext-v$V/companion-$V.zip` (the version-pinned asset from step 6 — **not** `companion-latest`; the catalog wants declared version == downloaded bits)
    - `requires.speckit_version`, `provides.commands` (count), and `tags` → re-sync from `speckit-extension/extension.yml` so the entry matches what shipped
    - Sanity-check the asset returns 200 before pushing; leave the rest of the entry (docs/README URL, homepage, changelog) untouched.
    - Reuse the existing catalog PR/branch if one is open; otherwise branch from the fork's up-to-date `main`. Keep `documentation` pointed at the single `README.md` blob (a directory URL renders blank in the catalog site).
11. **Report** the release URL + the **stable** install command (`…/releases/download/companion-latest/companion.zip`, re-runnable with `--force` to update), and the catalog PR URL. Remind that the by-name catalog install (`specify extension add companion`) needs the **Extension Submission issue** on github/spec-kit (see `publishing.md`) — that first-listing step is the user's call.

Update version references (README badge, `publishing.md`) to the new version; keep the documented install/update URL pointed at the stable `companion-latest/companion.zip`. Never commit a VS Code `package.json` version bump as part of this.
