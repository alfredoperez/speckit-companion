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
5. **Build the archive** — a **`.zip`** (the installer rejects `.tar.gz` with `BadZipFile`) with a **single top-level dir** `companion-<X.Y.Z>/` holding `extension.yml` at its root. The repo source-archive does **not** work, because the extension lives in a subdir (`extension.yml` wouldn't be at the archive root):
   ```bash
   V=0.2.0
   rm -rf /tmp/cb && mkdir -p /tmp/cb/companion-$V
   ( cd speckit-extension && tar cf - --exclude=tests --exclude=assets . ) | ( cd /tmp/cb/companion-$V && tar xf - )
   ( cd /tmp/cb && zip -rq companion-$V.zip companion-$V )
   ```
6. **Create the GitHub release** with a **prefixed tag** (`speckit-ext-v0.2.0`) and attach the zip:
   ```bash
   gh release create speckit-ext-v$V /tmp/cb/companion-$V.zip --title "..." --notes-file <CHANGELOG [X.Y.Z]> --target main
   ```
7. **Verify the deployed install** in a scratch dir (simulate a user): `mkdir -p /tmp/v/.specify/extensions && cd /tmp/v && yes | specify extension add companion --from <release-zip-url> --force` → `specify extension list` shows the version + all commands. Note: the **`companion` name arg is required**, the URL must be **HTTPS**, and a raw-URL install shows a one-time "untrusted source" prompt. If a prior local install left inconsistent emission dirs, nuke all `speckit-companion-*` / `speckit.companion.*` artifacts first.

   **What a real install looks like** (so the output below isn't mistaken for an error):

   - **Untrusted-source prompt** — installing from a raw release URL (not yet catalog-listed) shows a one-time `⚠ Untrusted Source` box with the URL and `Continue with installation? [y/N]:`. Answer `y` (or pipe `yes |`). This is expected until the catalog lists `companion`.
   - **Already-installed guard** — if a prior `companion` is present, the install aborts with `Extension 'companion' is already installed. … retry with --force`. Either `specify extension remove companion` first (config is backed up to `.specify/extensions/.backup/companion/`) or re-run with `--force`.
   - **Stale/corrupted leftover** — `specify extension list` may show an old `✗ companion (v0.1.0) … ⚠️ Corrupted extension, Commands: 0`. Remove it (`yes | specify extension remove companion`) before installing the current release; the fresh install reports `✓ Extension installed successfully! SpecKit Companion (v0.2.0)` with all 6 commands.
   - **"Configuration may be required" footer** — a successful install ends with `⚠ Configuration may be required / Check: .specify/extensions/companion/`. This is **informational, not a failure** — it points at the installed extension dir; no manual config step is needed for companion.
8. **Submit to the catalog** — file an **issue** on github/spec-kit using the **Extension Submission** template (NOT a PR). Maintainers verify metadata + URL reachability and add the entry to `extensions/catalog.community.json`. Review is 3–7 business days. Only then does the by-name `specify extension add companion` resolve.
9. **For later updates** — repeat, and file a new submission issue noting it's an update.

The whole flow is automated by the `/publish-speckit-ext` skill.

## Pre-submit checklist (mapped to the guide)

- [x] `id` lowercase-with-hyphens — `companion`
- [x] `version` semver — `0.2.0`
- [x] `description` < 100 chars — 88
- [x] `repository` valid public GitHub URL
- [x] `homepage` present
- [x] `license` field + **LICENSE file** in `speckit-extension/`
- [x] `tags` 2–5, lowercase — `spec-driven-development`, `tracking`, `companion`
- [x] every `provides.commands[].file` exists (6: capture, capture-plan/-tasks/-implement, status, resume)
- [x] `README.md` + `CHANGELOG.md` present
- [ ] GitHub release created with a `speckit-ext-v*` tag + archive URL
- [ ] Extension Submission issue filed

## Catalog submission (ready to paste)

```yaml
id: companion
name: SpecKit Companion
version: 0.2.0
description: "Live spec-driven progress for SpecKit Companion — lifecycle capture, status, and resume."
author: alfredoperez
repository: https://github.com/alfredoperez/speckit-companion
homepage: https://github.com/alfredoperez/speckit-companion/tree/main/speckit-extension
license: MIT
requires:
  speckit_version: ">=0.8.5"
tags: [spec-driven-development, tracking, companion]
commands:
  - speckit.companion.capture          # after_specify hook
  - speckit.companion.capture-plan     # after_plan hook
  - speckit.companion.capture-tasks    # after_tasks hook
  - speckit.companion.capture-implement# after_implement hook (per-task journaling)
  - speckit.companion.status           # report step/status/decisions/next action
  - speckit.companion.resume           # resume the pipeline from the recorded step
download_url: https://github.com/alfredoperez/speckit-companion/releases/download/speckit-ext-v0.2.0/companion-0.2.0.zip
```

### What this release delivers (for the submission body)

SpecKit Companion captures the spec-kit lifecycle into a per-spec `.spec-context.json` (canonical append-only `history[]`) so a GUI — or the two read commands below — can show where every spec stands and resume it:

- **Lifecycle capture** — `after_specify/plan/tasks/implement` hooks record each step; `--tasks-file` journals per-task implement progress; `derive-from-files.py` reconstructs state when a hook never fired.
- **Status** — `/speckit.companion.status` prints current step, status, recorded decisions, and the next action.
- **Resume** — `/speckit.companion.resume` continues the pipeline from the recorded step with decisions in scope, dispatching the next `/speckit.*` command (works on stock spec-kit — no `specify workflow resume` subcommand required).

Stdlib-only Python; degrades gracefully without `python3`; never fails the host spec-kit command.
