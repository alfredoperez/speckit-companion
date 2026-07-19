# Publishing the spec-kit extension

How to publish the **spec-kit extension** (`id: companion`) to the github/spec-kit community catalog. This is **separate** from publishing the VS Code extension (that's `/publish` → `v*` tag → `release.yml` → Marketplace). Source of truth for requirements: [github/spec-kit EXTENSION-PUBLISHING-GUIDE.md](https://github.com/github/spec-kit/blob/main/extensions/EXTENSION-PUBLISHING-GUIDE.md).

## ⚠️ Tag namespace (do not collide with the VS Code release)

`release.yml` publishes the VS Code extension on any **`v*`** tag. The spec-kit extension MUST therefore use a **prefixed** tag so it never triggers a Marketplace publish:

```
speckit-ext-v0.2.0      ✅  (does not match v*)
v0.2.0                  ❌  matches v* → would publish the WRONG thing to the Marketplace
```

## Process

1. **Bump** `speckit-extension/extension.yml` `extension.version` (semver).
2. **Update** `speckit-extension/CHANGELOG.md` — new dated section; keep prior versions.
3. **Verify** the pre-submit checklist below.
4. **Commit** to `main` (e.g. `chore(speckit-ext): release v0.2.0`).
5. **Build the archive** — a **`.zip`** (the installer rejects `.tar.gz` with `BadZipFile`) with a **single top-level dir** `companion-<X.Y.Z>/` holding `extension.yml` at its root. The repo source-archive does **not** work, because the extension lives in a subdir (`extension.yml` wouldn't be at the archive root). The package is an **allow-list of runtime files only** — copy just what the installed extension runs, not the whole source tree:
   ```bash
   V=0.2.0
   rm -rf /tmp/cb && mkdir -p /tmp/cb/companion-$V/scripts
   cd speckit-extension
   cp extension.yml LICENSE /tmp/cb/companion-$V/
   cp -R commands workflows /tmp/cb/companion-$V/
   python3 scripts/package-manifest.py --copy-to /tmp/cb/companion-$V/scripts
   cd - >/dev/null
   ( cd /tmp/cb && zip -rq companion-$V.zip companion-$V )
   ```

   **What ships (and what doesn't).** The package carries `extension.yml`, `LICENSE`, `commands/`, `workflows/`, and the runtime scripts. **Which scripts those are is not restated here** — `package-manifest.py` is the single source of truth, and `--copy-to` fills the archive straight from it. That is deliberate: this list used to be typed out in prose in two places, drifted behind the commands that call the scripts, and shipped an archive missing five of them, which left the adoption, drift, and coverage commands unrunnable for anyone who installed from a release (#432). Run `python3 scripts/package-manifest.py --list` to see the current set.

   The archive deliberately **omits** README, CHANGELOG, ROADMAP, `docs/`, `examples/`, the build-only `nodes/`+`presets/` sources, the build/test scripts, `tests/`, and `assets/`. The catalog page renders README/CHANGELOG from the GitHub blob URLs below — they're not needed inside the zip. This is still an **allow-list**; don't swap it back to a `tar --exclude` deny-list, or new docs/sources will silently bloat the package again.

   **`--copy-to` leaves the destination holding exactly that list.** It clears any scripts already sitting there first, so a reused staging dir can't slip a leftover (say, a build-only script from an older layout) into the zip. It only ever removes loose `.py` files, never recursively: a destination holding anything else — a subdirectory, a document, the `speckit-extension/scripts/` source tree itself — is refused with the offending entries named, so a mistyped path can't be emptied.

   **The list cannot silently fall behind again.** `package-manifest.py --check` derives what the shipped commands actually reach for — scanning the command bodies, then following each script's own imports — and fails if that disagrees with the packed set in either direction, naming the offending script. It runs in CI on every PR, and `--copy-to` refuses to build an archive from a failing list. A new command that calls a new script now blocks the build until the script is packaged.
6. **Create the GitHub release** with a **prefixed tag** (`speckit-ext-v0.2.0`) and attach the version-named zip (archival):
   ```bash
   gh release create speckit-ext-v$V /tmp/cb/companion-$V.zip --title "..." --notes-file <CHANGELOG [X.Y.Z]> --target main
   ```
7. **Refresh the stable `companion-latest` asset** — the README/install docs point users at a *stable* URL so install/update never needs a version edit. Force-replace `companion.zip` on a reusable `companion-latest` **prerelease** with the same build:
   ```bash
   cp /tmp/cb/companion-$V.zip /tmp/cb/companion.zip
   if gh release view companion-latest >/dev/null 2>&1; then
     gh release upload companion-latest /tmp/cb/companion.zip --clobber
   else
     gh release create companion-latest /tmp/cb/companion.zip --title "SpecKit Companion (latest)" --prerelease --target main
   fi
   gh release edit companion-latest --prerelease   # idempotent — re-asserts prerelease every run
   ```
   > Use `if/else`, not `view && upload || create`: with the `&&…||` chain a transient `upload` failure falls through to `create` and then errors on the already-existing tag, masking the real fault.
   **Why a dedicated tag, not `/releases/latest`:** this is a two-product repo — `release.yml` publishes the VS Code extension on `v*` tags, and those releases interleave with `speckit-ext-v*` in one GitHub releases list. GitHub's `/releases/latest` resolves to the newest non-prerelease across **both** products, so `…/releases/latest/download/companion.zip` would 404 the moment the next VS Code `v*` release is cut. The stable URL `…/releases/download/companion-latest/companion.zip` resolves **by tag** and is immune to that interleaving. The `--prerelease` flag keeps `companion-latest` out of `/releases/latest`; the non-`v*` tag keeps it from triggering the Marketplace publish.
8. **Verify the deployed install** in a scratch dir (simulate a user), from the **stable** URL: `mkdir -p /tmp/v/.specify/extensions && cd /tmp/v && yes | specify extension add companion --from https://github.com/alfredoperez/speckit-companion/releases/download/companion-latest/companion.zip --force` → `specify extension list` shows the version + all commands. Note: the **`companion` name arg is required**, the URL must be **HTTPS**, and a raw-URL install shows a one-time "untrusted source" prompt. If a prior local install left inconsistent emission dirs, nuke all `speckit-companion-*` / `speckit.companion.*` artifacts first.

   **What a real install looks like** (so the output below isn't mistaken for an error):

   - **Untrusted-source prompt** — installing from a raw release URL (not yet catalog-listed) shows a one-time `⚠ Untrusted Source` box with the URL and `Continue with installation? [y/N]:`. Answer `y` (or pipe `yes |`). This is expected until the catalog lists `companion`.
   - **Already-installed guard** — if a prior `companion` is present, the install aborts with `Extension 'companion' is already installed. … retry with --force`. Either `specify extension remove companion` first (config is backed up to `.specify/extensions/.backup/companion/`) or re-run with `--force`.
   - **Stale/corrupted leftover** — `specify extension list` may show an old `✗ companion (v0.1.0) … ⚠️ Corrupted extension, Commands: 0`. Remove it (`yes | specify extension remove companion`) before installing the current release; the fresh install reports `✓ Extension installed successfully! SpecKit Companion (v0.2.0)` with all 6 commands.
   - **"Configuration may be required" footer** — a successful install ends with `⚠ Configuration may be required / Check: .specify/extensions/companion/`. This is **informational, not a failure** — it points at the installed extension dir; no manual config step is needed for companion.
9. **Submit to the catalog (first listing only)** — file an **issue** on github/spec-kit using the **Extension Submission** template (NOT a PR). Maintainers verify metadata + URL reachability and add the entry to `extensions/catalog.community.json`. Review is 3–7 business days. Only then does the by-name `specify extension add companion` resolve. The catalog **pins each entry to a version-specific asset** (`download_url` → `speckit-ext-v<X.Y.Z>/companion-<X.Y.Z>.zip`), so declared `version` and downloaded bits always agree — this is what every other catalog entry does. (The `companion-latest` rolling asset still exists, but it's for our own `--force` re-install URL, not the catalog.)
10. **For later updates** — because the catalog is version-pinned, **every release needs a one-line catalog PR** bumping `version` + `download_url` (and re-syncing `requires.speckit_version` / `provides.commands` / `tags` from `extension.yml`). The `/publish-speckit-ext` skill opens/refreshes that PR automatically as its last step — no separate submission issue is needed once the entry exists. Existing users still update by re-running their install command against the stable `companion-latest` URL with `--force`.

The whole flow is automated by the `/publish-speckit-ext` skill.

## Pre-submit checklist (mapped to the guide)

- [x] `id` lowercase-with-hyphens — `companion`
- [x] `version` semver — matches `extension.yml` `extension.version` (e.g. `X.Y.Z`)
- [x] `description` < 100 chars — 88
- [x] `repository` valid public GitHub URL
- [x] `homepage` present
- [x] `license` field + **LICENSE file** in `speckit-extension/`
- [x] `tags` 2–5, lowercase — `spec-driven-development`, `tracking`, `companion`
- [x] every `provides.commands[].file` exists (6: capture, capture-plan/-tasks/-implement, status, resume)
- [x] `README.md` + `CHANGELOG.md` present
- [ ] **No version-pinned install download URL in shipped code/docs** — the in-editor Install/Update must point at the stable rolling `companion-latest/companion.zip` asset, never a `speckit-ext-vX.Y.Z` / `companion-X.Y.Z.zip` pin (a pin makes "Update" a silent downgrade). This must return **nothing** before tagging:
  ```bash
  grep -rnE 'releases/download/(speckit-ext-v[0-9]|companion-[0-9])' src speckit-extension README.md
  ```
- [ ] GitHub release created with a `speckit-ext-v*` tag + archive URL
- [ ] Extension Submission issue filed

## Catalog submission (ready to paste)

```yaml
id: companion
name: SpecKit Companion
version: 0.11.0
description: "Live spec-driven progress for SpecKit Companion — lifecycle capture, status, and resume."
author: alfredoperez
repository: https://github.com/alfredoperez/speckit-companion
homepage: https://github.com/alfredoperez/speckit-companion/tree/main/speckit-extension
documentation: https://github.com/alfredoperez/speckit-companion/blob/main/speckit-extension/README.md
changelog: https://github.com/alfredoperez/speckit-companion/blob/main/speckit-extension/CHANGELOG.md
license: MIT
requires:
  speckit_version: ">=0.8.5"
tags: [spec-driven-development, tracking, companion]
commands:
  - speckit.companion.after-specify          # after_specify hook
  - speckit.companion.after-plan     # after_plan hook
  - speckit.companion.after-tasks    # after_tasks hook
  - speckit.companion.after-implement# after_implement hook (per-task journaling)
  - speckit.companion.status           # report step/status/decisions/next action
  - speckit.companion.resume           # resume the pipeline from the recorded step
download_url: https://github.com/alfredoperez/speckit-companion/releases/download/companion-latest/companion.zip
```

### What this release delivers (for the submission body)

SpecKit Companion captures the spec-kit lifecycle into a per-spec `.spec-context.json` (canonical append-only `history[]`) so a GUI — or the two read commands below — can show where every spec stands and resume it:

- **Lifecycle capture** — `after_specify/plan/tasks/implement` hooks record each step; `--tasks-file` journals per-task implement progress; `derive-from-files.py` reconstructs state when a hook never fired.
- **Status** — `/speckit.companion.status` prints current step, status, recorded decisions, and the next action.
- **Resume** — `/speckit.companion.resume` continues the pipeline from the recorded step with decisions in scope, dispatching the next `/speckit.*` command (works on stock spec-kit — no `specify workflow resume` subcommand required).

Stdlib-only Python; degrades gracefully without `python3`; never fails the host spec-kit command.

## Catalog page display gotchas (community site)

The community site (`speckit-community.github.io/extensions/<id>`) is a static site that bakes two things at build time. Both behave differently than the catalog `version`/`description` fields suggest, and both are sharper for us because the extension lives in a **subdirectory of a monorepo** rather than its own repo:

- **`documentation` IS the rendered README.** The page's main content area is whatever the catalog `documentation` URL points at, fetched as markdown. **It must be a specific `.md` file** (`…/speckit-extension/README.md`), never a directory — a directory URL fetches nothing and the page renders a blank README (`readmeContent: null`). This is why the snippet above sets `documentation` explicitly.
- **The displayed version is the GitHub release tag, not the catalog `version`.** The site shows the repo's release tag (with a `release` badge). Because our tag is **prefixed** (`speckit-ext-v*`, required so the release doesn't trigger the VS Code Marketplace publish on `v*`), the page shows `speckit-ext-v0.3.0` instead of `0.3.0`. It also tracks whichever release is newest in the repo, so a later VS Code `/publish` (a `v*` tag) can surface on the companion page. A dedicated single-purpose repo with clean `v*` tags (README at root, standard `archive/refs/tags/v*.zip` install) is the only way to get a clean version + install line matching the other catalog extensions; the monorepo can't without colliding with the Marketplace release tag.
