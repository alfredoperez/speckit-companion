# Contributing to the spec-kit extension

This guide is for working on the **spec-kit extension** (`speckit-extension/`, `id: companion`).

> **Two extensions, one repo.** This monorepo ships two independently-versioned products:
> - the **VS Code extension** (the GUI) — see the repo-root [`CONTRIBUTING.md`](../../CONTRIBUTING.md), [`README.md`](../../README.md), [`CHANGELOG.md`](../../CHANGELOG.md), `package.json` (v0.18.x);
> - the **spec-kit extension** (this folder) — its own [`README.md`](../README.md), [`ROADMAP.md`](../ROADMAP.md), [`CHANGELOG.md`](../CHANGELOG.md), and `extension.yml` (v0.1.0).
>
> They're published to different places (VS Code Marketplace vs the spec-kit catalog) and versioned separately. This doc covers only the spec-kit extension.

## Layout

```
speckit-extension/
├── extension.yml          # manifest: id, version, requires, provides.commands, hooks
├── commands/              # command-markdown (the agent runs these)
├── scripts/               # write-context.py (the writer)
├── docs/                  # install, commands, how-it-works, contributing (this file)
├── README.md  ROADMAP.md  CHANGELOG.md
```

`speckit-extension/` is the **source**. When installed, spec-kit copies it into `.specify/extensions/companion/` (the **installed fixture**) — that copy is what makes the hooks resolvable at runtime. Both are committed (the fixture mirrors how the bundled `git` extension is committed); edit the **source**, then re-install to refresh the fixture.

## Dev loop (per roadmap step)

Each migration step (see [ROADMAP.md](../ROADMAP.md)) is one PR-sized change:

1. **Branch from `main`.** Don't stack on a previously-merged branch — the repo squash-merges, so old commits won't be in your new branch's history.
2. **Edit the source** in `speckit-extension/`: register a hook in `extension.yml`, add a `commands/speckit.companion.<cmd>.md`, and/or extend `scripts/write-context.py`.
3. **Install locally to test:**
   ```bash
   specify extension add ./speckit-extension --dev
   ```
   This refreshes `.specify/extensions/companion/`, re-registers hooks in `.specify/extensions.yml`, and re-emits the per-agent commands so your change is live. (Prereq: a github-source spec-kit — see [install.md](./install.md).)
4. **Run the real command** (`/speckit.specify`, `/speckit.plan`, …), watch the hook fire, and confirm `.spec-context.json` updates (and the Companion GUI re-renders). See [how-it-works.md](./how-it-works.md#end-to-end-proof).
5. **Commit** the source **and** the refreshed fixture/per-agent files together; open a PR; squash-merge; return to `main`.

## Tests

```bash
python3 -m unittest discover -s speckit-extension/tests -p "test_*.py"
```

That is what CI runs, and it is all deterministic — no network, no model. `test_builder_flow.py` drives every change the pipeline builder can make through `config_write.py`, builds, and reads the built command bodies back; `test_customised_quality.py` then holds that customised build to the same quality eval and instruction budget as the shipped commands.

One test is opt-in, because it runs a real model and takes a few minutes:

```bash
SPECKIT_RUN_E2E=1 python3 -m unittest discover -s speckit-extension/tests \
    -p "test_customised_run.py"
```

It customises a real `specify init` project, builds it, and actually runs the specify step through the `claude` CLI — the only check that a customised pipeline still *runs* rather than merely building. It skips wherever `claude` or `specify` is missing, so CI reports it as skipped rather than failing. Worth running by hand after changing a node, a hook type, or anything in the build.

## Per-release checklist

- Bump `version` in `extension.yml` (SemVer; independent of the VS Code extension's `package.json`).
- Add a `CHANGELOG.md` entry under a new version heading.
- Update `ROADMAP.md` status for the shipped step.
- Update the relevant `docs/` page if behavior or commands changed; keep the README a tight "why install / quick start / links" page.

## Good to know

- **`companion` is installed in this repo (dogfooding).** Running `/speckit.specify` here auto-fires the `after_specify` capture — expected, harmless.
- **Coexists with SDD.** The `/sdd:*` flow writes `.spec-context.json` itself; this extension only fires on `/speckit.*`. Mixed authorship in `history[].by` is normal.
- **Best-effort contract.** The writer must never fail the host spec-kit command — keep new script paths warn-and-exit-0 on error (see `write-context.py`).
- **Schema is owned by the GUI repo** at `src/core/types/spec-context.schema.json`; extend it there, never vendor a copy.
