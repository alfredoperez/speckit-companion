# Install

## Prerequisite — an extension-capable spec-kit

The `specify extension` subsystem ships in the **GitHub-source** build of spec-kit. The stock PyPI `specify-cli` package only exposes `init` / `check` / `version` and will fail with *"No such command 'extension'"*. Install from source (a global `uv` tool change, not project-local):

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git --force
specify extension --help     # confirm `add` / `list` are present
```

`python3` is also used by the capture script — but it's an **optional** tool: the capture degrades gracefully (warns + skips) if `python3` is absent and never fails the host spec-kit command.

> **Version floor:** the extension declares `requires.speckit_version: ">=0.8.5"` (the floor for the workflow `integration: auto` path later phases ride). Confirm/raise once the exact spec-kit release that wired `after_specify`/`after_plan` is verified.

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

## Verify

```bash
specify extension list        # companion present
```

Then run a real `/speckit.specify` and confirm `specs/<NNN>-<slug>/.spec-context.json` is written — see [how-it-works.md](./how-it-works.md#end-to-end-proof) for the full check.
