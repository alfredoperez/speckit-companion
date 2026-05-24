# SpecKit Companion — spec-kit Extension

A [spec-kit](https://github.com/github/spec-kit) extension (`id: companion`) that
captures your spec-kit lifecycle activity into `.spec-context.json`, so the
**SpecKit Companion** VS Code GUI lights up on your *existing* spec-kit flow — no
template change, no GUI code change.

This directory is the spec-kit-catalog half of the SpecKit Companion monorepo; it
lives beside the VS Code extension (`src/`, `webview/`) and is published/installed
independently. It does **not** read or depend on the GUI at runtime — it only
writes the canonical `.spec-context.json` the GUI already consumes.

> **Status: foundation spike (v1, one hook).** This ships the de-risking slice
> from spec `106-speckit-extension-foundation`: a single `after_specify` hook that
> writes `.spec-context.json`. The other lifecycle hooks, the derive-from-files
> fallback, and the `status`/`resume` commands are deferred to later steps.

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

The chain mirrors spec-kit's bundled `git` extension exactly:
**hook → command-markdown → "run this script."**

```
/speckit.specify  →  after_specify hook  →  speckit.companion.capture.md  →  write-context.py  →  .spec-context.json  →  Companion GUI re-renders
```

## What the writer does

`write-context.py` does a crash-safe **read-merge-write** of the active feature's
`.spec-context.json`:

- **Active-dir resolution** (spec-kit's order, most-specific first):
  `--feature-dir` → `SPECIFY_FEATURE_DIRECTORY` env → `SPECIFY_FEATURE` env →
  `.specify/feature.json` → current git-branch numeric prefix.
- **Preserves** every existing/unknown top-level key (e.g. Companion-owned
  `reviewComments`) — never clobbers.
- **Append-only** `transitions` (`by: "extension"`); `from` is the prior
  `{step, substep}`, or `null` on first write.
- **Atomic**: writes a temp file then `os.replace()`.
- Writes Companion-canonical values (`currentStep: "specify"`,
  `status: "specified"`); **never** the legacy `currentStep: "done"`.

The canonical schema is owned by the GUI repo at
`src/core/types/spec-context.schema.json` — the writer targets it directly (no
vendored copy).

## Requirements

- `requires.speckit_version: ">=0.8.5"` — the floor for the workflow
  `integration: auto` path later phases ride.

  > ⚠ **Confirm the exact `after_specify` floor.** The spec-kit release that first
  > wired the `after_specify` / `after_plan` lifecycle hooks may differ from
  > `0.8.5`. Verify against the installed spec-kit and raise this floor if needed.
- `python3` — declared as an **optional** tool. The capture is best-effort and
  degrades gracefully (warns + skips) if `python3` is absent; it never fails the
  host spec-kit command.

## Install

Install into a spec-kit project and emit Claude assets:

```bash
specify extension add companion --ai-skills
```

> **Note — `--ai-skills` is non-destructive on update.** Re-installing will *not*
> overwrite an existing `SKILL.md`; use `--force` / re-init to upgrade installed
> Claude assets.

Registration lives in `.specify/extensions.yml` (this repo wires it under
`after_specify`, alongside the bundled `git` extension's auto-commit — both run).

## End-to-end proof (the de-risk)

The whole migration rests on one unproven chain: *user runs a spec-kit command →
the agent runs our hook → our script writes `.spec-context.json` → the Companion
GUI re-renders.* Reproduce it:

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

Expected: a valid canonical `.spec-context.json` with `currentStep: "specify"`,
`status: "specified"`, and a single `transitions` entry `{ "by": "extension",
"from": null }`. Re-running appends a second transition (with `from` set) and
preserves any pre-existing keys.

### B. Live hook + GUI (manual — needs the VS Code GUI)

1. Install the SpecKit Companion VS Code extension and open this repo.
2. Ensure `companion` is registered under `after_specify` in
   `.specify/extensions.yml` (it is, in this repo).
3. In Claude Code, run a real `/speckit.specify "throwaway proof feature"`.
4. When the `after_specify` hook prompt fires, let it run
   `speckit.companion.capture`.
5. Confirm the new `specs/<NNN>-<slug>/.spec-context.json` carries
   `currentStep: specify` / `status: specified` / a `by: extension` transition.
6. Open the SpecKit Companion sidebar/viewer — the new spec should render at the
   **specify** step with **specified** status, with no GUI code change.
7. Delete the throwaway spec.

### Observed result

- **A (script + resolution):** ✅ Verified — the writer creates/updates a canonical
  `.spec-context.json` with the expected values; append-only transitions and
  unknown-key preservation confirmed by the spec's probe test.
- **B (live hook + GUI):** ⏳ Pending manual confirmation in an interactive VS
  Code session (records whether the agent auto-fires the `after_specify` prompt —
  hooks are agent-mediated, so this is the behavior the spike exists to observe).
