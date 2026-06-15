# Install

## Prerequisite — an extension-capable spec-kit

The `specify extension` subsystem ships in the **GitHub-source** build of spec-kit. The stock PyPI `specify-cli` package only exposes `init` / `check` / `version` and will fail with *"No such command 'extension'"*. Install from source (a global `uv` tool change, not project-local):

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git --force
specify extension --help     # confirm `add` / `list` are present
```

`python3` is also used by the capture script — but it's an **optional** tool: the capture degrades gracefully (warns + skips) if `python3` is absent and never fails the host spec-kit command.

> **Version floor:** the extension declares `requires.speckit_version: ">=0.8.5"` (the floor for the workflow `integration: auto` path later phases ride). Confirm/raise once the exact spec-kit release that wired `after_specify`/`after_plan` is verified.

## From the release archive (recommended)

Install from the **stable** release URL — it always serves the newest build, so the same command installs and updates:

```bash
specify extension add companion --from https://github.com/alfredoperez/speckit-companion/releases/download/companion-latest/companion.zip --force
specify extension list   # confirm "companion" is listed at the new version
```

**To update:** re-run the exact same command. The `companion-latest/companion.zip` URL is reused on every release (it's a dedicated rolling asset, not a version-pinned one), and `--force` refreshes an existing install in place — no version string to edit, no new URL to find. A raw-URL install shows a one-time "untrusted source" prompt until the catalog lists `companion`.

> **Why not `/releases/latest/download/…`?** This repo publishes two products into one releases list (the VS Code extension on `v*` tags and this extension on `speckit-ext-v*` tags). GitHub's `/releases/latest` tracks the newest release across **both**, so a `/releases/latest/download/companion.zip` URL would 404 the moment the next VS Code release is cut. The `companion-latest` tag above resolves by name and is immune to that.

## Local / development (today)

Not published to the spec-kit catalog yet, so install straight from this directory. From the repo root:

```bash
specify extension add ./speckit-extension --dev   # installs into .specify/extensions/companion/
specify extension list                            # confirm "companion" is listed
```

`--dev` copies the extension into `.specify/extensions/companion/` (where spec-kit resolves command-markdown), registers its hooks in `.specify/extensions.yml`, and emits the per-agent command (e.g. into `.claude/`) so the hook is actually resolvable. A bare registration in `.specify/extensions.yml` is **not** enough on its own — that placement + emission is what the install does.

> This repo commits a registration stub for `companion`. If `specify extension add` reports it's already installed, run `specify extension remove companion` first, then re-run the `add ./speckit-extension --dev` above.

## Catalog (future)

Once published:

```bash
specify extension add companion --ai-skills
```

> **`--ai-skills` is non-destructive on update.** Re-installing will *not* overwrite an existing `SKILL.md`; use `--force` / re-init to upgrade installed Claude assets.

## Fallback — CLI-less manual install

If you're stuck on the stock PyPI build and can't reinstall, replicate what the CLI does by hand: copy `speckit-extension/` → `.specify/extensions/companion/`, add a `companion` entry to `.specify/extensions/.registry`, and emit a `.claude/skills/speckit-companion-capture/SKILL.md` mirroring `.claude/skills/speckit-git-commit/SKILL.md`. This is a stopgap — the supported path is the source install above.

## Command families (stock SpecKit + the Companion workflow)

Two command families stay installed at once — installing one never removes the other. The stock `/speckit.*` commands (+ timing) are carried by the `companion-standard` preset; the SpecKit Companion workflow is the namespaced `/speckit.companion.*` commands (lean — no user stories, trimmed plan, files/dependencies tasks). See the full reference in [`../../docs/template-profiles.md`](../../docs/template-profiles.md).

The Companion workflow is an opt-in beta gated by the `speckit.companion.speckitCompanionWorkflow` VS Code setting (off by default); stock SpecKit is always available regardless. Both families coexist — no preset is added, removed, or swapped when you toggle the gate, so you never lose a command set. The extension keeps `companion-standard` present with an **add-only** activation ensure (it never removes it), which also recovers a project whose stock commands a prior version may have stranded.

The stock carrier installs from the bundled path; verify or (re-)materialize it manually with:

```bash
specify preset add --dev ./speckit-extension/presets/companion-standard   # local/dev install
```

> `specify preset resolve` reports *template* overrides only; these are `type: command` overrides, so it prints "No template…" — confirm `companion-standard` instead by checking that `.specify/presets/companion-standard/` exists and the re-emitted command body carries the timing partial.

## Verify

```bash
specify extension list        # companion present
specify preset list           # companion-standard present
```

Then run a real `/speckit.specify` and confirm `specs/<NNN>-<slug>/.spec-context.json` is written — see [how-it-works.md](./how-it-works.md#end-to-end-proof) for the full check. With the Companion workflow, confirm the produced `spec.md` has no user-story section.

> The capture hook invokes the script at its **installed** path, `.specify/extensions/companion/scripts/write-context.py` (mirroring the `git` extension's `.specify/extensions/git/scripts/…` convention) — not the source-repo `speckit-extension/scripts/…`. That's why it runs cleanly on any install. If you ever see `No such file or directory` for `speckit-extension/scripts/…`, the command-markdown drifted back to the dev-source path.
