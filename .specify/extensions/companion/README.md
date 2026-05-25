# SpecKit Companion — spec-kit Extension

Optional workflow enhancements for the [SpecKit Companion](https://github.com/alfredoperez/speckit-companion) product. This is the spec-kit-side half (`id: companion`) that captures your spec-kit lifecycle activity into `.spec-context.json` so the **SpecKit Companion** VS Code GUI lights up on your *existing* spec-kit flow — no template change, no GUI code change. It's the first slice of a larger set of optional features (status/resume, an opinionated pipeline, living-specs/drift, auto-mode) that layer SDD onto spec-kit over time.

This directory is the spec-kit-catalog half of the SpecKit Companion monorepo; it lives beside the VS Code extension (`src/`, `webview/`) and is published/installed independently. It does **not** read or depend on the GUI at runtime — it only writes the canonical `.spec-context.json` the GUI already consumes.

> **Status: foundation spike (v1, one hook).** This ships the de-risking slice from spec `106-speckit-extension-foundation`: a single `after_specify` hook that writes `.spec-context.json`. The other lifecycle hooks, the derive-from-files fallback, and the `status`/`resume` commands are deferred to later steps.

## What's here

```
speckit-extension/
├── extension.yml                          # manifest: id companion, one after_specify hook
├── commands/
│   └── speckit.companion.capture.md        # command-markdown: "run the writer script"
├── scripts/
│   └── write-context.py                    # the writer (stdlib Python, atomic, append-only)
└── README.md
```

The chain mirrors spec-kit's bundled `git` extension exactly: **hook → command-markdown → "run this script."**

```
/speckit.specify  →  after_specify hook  →  speckit.companion.capture.md  →  write-context.py  →  .spec-context.json  →  Companion GUI re-renders
```

## What the writer does

`write-context.py` does a crash-safe **read-merge-write** of the active feature's `.spec-context.json`:

- **Active-dir resolution** (spec-kit's order, most-specific first): `--feature-dir` → `SPECIFY_FEATURE_DIRECTORY` env → `SPECIFY_FEATURE` env → `.specify/feature.json` → current git-branch numeric prefix.
- **Preserves** every existing/unknown top-level key (e.g. Companion-owned `reviewComments`) — never clobbers.
- **Append-only** `transitions` (`by: "extension"`); `from` is the prior `{step, substep}`, or `null` on first write.
- **Never regresses** a more-advanced spec: if the target is already at a later step or a terminal status (`implemented`/`completed`/`archived`), it is left untouched.
- **Atomic**: writes a temp file then `os.replace()`.
- Writes Companion-canonical values (`currentStep: "specify"`, `status: "specified"`); **never** the legacy `currentStep: "done"`.

The canonical schema is owned by the GUI repo at `src/core/types/spec-context.schema.json` — the writer targets it directly (no vendored copy).

## Requirements

- **An extension-capable spec-kit.** The extension subsystem (`specify extension …`) ships in the **GitHub-source** build of spec-kit, *not* the stock PyPI `specify-cli` package — see [Install](#install) below.
- `requires.speckit_version: ">=0.8.5"` — the floor for the workflow `integration: auto` path later phases ride.

  > ⚠ **Confirm the exact `after_specify` floor.** The spec-kit release that first wired the `after_specify` / `after_plan` lifecycle hooks may differ from `0.8.5`. Verify against the installed spec-kit and raise this floor if needed.
- `python3` — declared as an **optional** tool. The capture is best-effort and degrades gracefully (warns + skips) if `python3` is absent; it never fails the host spec-kit command.

## Install

### Prerequisite — an extension-capable spec-kit

The `specify extension` subsystem is part of the **GitHub-source** spec-kit. The stock PyPI `specify-cli` package only exposes `init` / `check` / `version` and will fail with *"No such command 'extension'"*. Install from source (a global `uv` tool change, not project-local):

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git --force
specify extension --help     # confirm `add` / `list` are present
```

### Local / development (today)

Not published to the spec-kit catalog yet, so install straight from this directory. From the repo root:

```bash
specify extension add ./speckit-extension --dev   # installs into .specify/extensions/companion/
specify extension list                            # confirm "companion" is listed
```

`--dev` copies the extension into `.specify/extensions/companion/` (where spec-kit resolves command-markdown), registers its hooks in `.specify/extensions.yml`, and emits the per-agent command (e.g. into `.claude/`) so the hook is actually resolvable. A bare registration in `.specify/extensions.yml` is **not** enough on its own — that placement + emission is what the install does.

> This repo commits a registration stub for `companion`. If `specify extension add` reports it's already installed, run `specify extension remove companion` first, then re-run the `add ./speckit-extension --dev` above.

### Catalog (future)

Once published:

```bash
specify extension add companion --ai-skills
```

> **`--ai-skills` is non-destructive on update.** Re-installing will *not* overwrite an existing `SKILL.md`; use `--force` / re-init to upgrade installed Claude assets.

### Fallback — CLI-less manual install

If you're stuck on the stock PyPI build and can't reinstall, you can replicate what the CLI does by hand: copy `speckit-extension/` → `.specify/extensions/companion/`, add a `companion` entry to `.specify/extensions/.registry`, and emit a `.claude/skills/speckit-companion-capture/SKILL.md` mirroring `.claude/skills/speckit-git-commit/SKILL.md`. This is a stopgap — the supported path is the source install above.

## End-to-end proof (the de-risk)

The whole migration rests on one unproven chain: *user runs a spec-kit command → the agent runs our hook → our script writes `.spec-context.json` → the Companion GUI re-renders.* Reproduce it:

### A. Script + resolution (deterministic — no GUI needed)

Mimics exactly what the `after_specify` hook invokes:

```bash
# Point spec-kit's active-feature pointer at a throwaway spec dir (as a real
# `specify` would), then run the capture the way the hook does:
mkdir -p specs/_zzz-proof-demo && printf '# Spec: Proof Demo\n' > specs/_zzz-proof-demo/spec.md
python3 speckit-extension/scripts/write-context.py --feature-dir specs/_zzz-proof-demo \
  --step specify --status specified --by extension
cat specs/_zzz-proof-demo/.spec-context.json   # currentStep=specify, status=specified, transitions[].by=extension
rm -rf specs/_zzz-proof-demo
```

Expected: a valid canonical `.spec-context.json` with `currentStep: "specify"`, `status: "specified"`, and a single `transitions` entry `{ "by": "extension", "from": null }`. Re-running appends a second transition (with `from` set) and preserves any pre-existing keys.

### B. Live hook + GUI (manual — needs the VS Code GUI)

1. **Install the extension** so the hook is resolvable (see [Install](#install) — both the source prerequisite and the `--dev` step):
   ```bash
   specify extension add ./speckit-extension --dev
   specify extension list      # confirm "companion" appears
   ```
2. Install/enable the SpecKit Companion **VS Code** extension and open this repo.
3. In Claude Code, run a real `/speckit.specify "throwaway proof feature"`.
4. When the `after_specify` hook fires, let it run `speckit.companion.capture`. (Hooks are agent-mediated — note whether it auto-fires or needs a nudge; that observation is the point of this proof.)
5. Confirm the new `specs/<NNN>-<slug>/.spec-context.json` carries `currentStep: specify` / `status: specified` / a `by: extension` transition:
   ```bash
   cat specs/<NNN>-<slug>/.spec-context.json
   ```
6. Open the SpecKit Companion sidebar/viewer — the new spec should render at the **specify** step with **specified** status, with no GUI code change.
7. Clean up: delete the throwaway spec dir; optionally `specify extension remove companion`.

### Observed result

- **A (script + resolution):** ✅ Verified — the writer creates/updates a canonical `.spec-context.json` with the expected values; append-only transitions and unknown-key preservation confirmed by the spec's probe test.
- **B (live hook + GUI):** ⏳ Pending manual confirmation in an interactive VS Code session (records whether the agent auto-fires the `after_specify` prompt — hooks are agent-mediated, so this is the behavior the spike exists to observe).
