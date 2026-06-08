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
5. **Create a GitHub release** with a **prefixed tag** (`speckit-ext-v0.2.0`) and attach a source archive of `speckit-extension/` (or use the auto-generated repo tarball URL as the download URL).
6. **Submit to the catalog** — file an **issue** on github/spec-kit using the **Extension Submission** template (NOT a PR). Maintainers verify metadata + URL reachability and add the entry to `extensions/catalog.community.json`. Review is 3–7 business days.
7. **For later updates** — repeat, and file a new submission issue noting it's an update.

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
