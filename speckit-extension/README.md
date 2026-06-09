<p align="center">
  <img src="https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/speckit-extension/assets/hero.jpg" alt="SpecKit Companion — spec-kit extension" width="100%">
</p>

<h1 align="center">SpecKit Companion — spec-kit Extension</h1>

<p align="center">
  <strong>Make your spec-driven work visible.</strong> Captures your spec-kit lifecycle into <code>.spec-context.json</code> so the SpecKit Companion VS Code GUI lights up on your existing flow — plus <code>status</code> &amp; <code>resume</code> to pick up where you left off.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/extension-companion-0b6dd9" alt="extension: companion">
  <img src="https://img.shields.io/badge/version-0.2.0-0b6dd9" alt="version 0.2.0">
  <img src="https://img.shields.io/badge/spec--kit-%E2%89%A50.8.5-008080" alt="requires spec-kit >= 0.8.5">
  <img src="https://img.shields.io/badge/license-MIT-gold" alt="license MIT">
</p>

```bash
specify extension add companion --from https://github.com/alfredoperez/speckit-companion/releases/download/speckit-ext-v0.2.0/companion-0.2.0.zip
```

> Tags: `#spec-driven-development` `#tracking` `#companion` · Independently maintained.

---

## Made for the SpecKit Companion VS Code extension

This is the **spec-kit-side half** of [**SpecKit Companion**](https://marketplace.visualstudio.com/items?itemName=alfredo-dev.speckit-companion) (`id: companion`). It runs inside spec-kit and **writes** the canonical `.spec-context.json` that the **VS Code GUI reads** — it never reads or depends on the GUI at runtime. The two are installed independently:

```bash
code --install-extension alfredo-dev.speckit-companion   # the GUI (VS Code Marketplace / OpenVSX)
specify extension add --from <release-url>                # this extension (spec-kit side)
```

Capture works on its own (the JSON is useful to any tool), but it's **built to feed the SpecKit Companion GUI** — that's where the captured state becomes a live sidebar, status badges, history, and a Resume button.

## Why install it

- **Live progress in the GUI** — each spec-kit step (specify → … → implement) appears in the Companion sidebar as it happens, with status and per-task history.
- **Zero workflow change** — it rides your *existing* spec-kit commands via lifecycle hooks. No new commands required just to get tracking.
- **Never lies about state** — when a hook didn't fire (skipped command, out-of-band run, a project that never had the extension), `derive-from-files.py` reconstructs the state from the artifacts on disk. The GUI reflects reality, not a half-truth.
- **Agent-agnostic** — works wherever spec-kit runs (Claude Code, Copilot, Cursor, Gemini, …), with extra depth on Claude.
- **Safe by design** — writes are atomic and append-only, preserve unknown fields, never regress a shipped spec, and never fail your spec-kit command. Stdlib-only Python; degrades gracefully when `python3` is absent.

## Commands

Four capture commands run automatically as lifecycle hooks; two are yours to run.

| Command | Runs | What it does |
|---------|------|--------------|
| `speckit.companion.capture` | `after_specify` hook | Record specify completion into `.spec-context.json` |
| `speckit.companion.capture-plan` | `after_plan` hook | Record plan completion (`planned`) |
| `speckit.companion.capture-tasks` | `after_tasks` hook | Record tasks completion (`ready-to-implement`) |
| `speckit.companion.capture-implement` | `after_implement` hook | Per-task journaling on implement (`implemented` when all tasks checked) |
| `/speckit.companion.status` | you | Print the current step, status, recorded decisions, and the next action |
| `/speckit.companion.resume` | you | Continue the pipeline from the recorded step — carries decisions into scope and dispatches the next `/speckit.*` command (at the next unchecked task inside implement) |
| `/speckit.companion.specify` · `.plan` · `.tasks` · `.implement` | you | Opt-in lean pipeline — emit the lean shape (no user stories, lean plan, files/dependencies tasks) for one spec, regardless of the project's profile |

Full reference: [docs/commands.md](./docs/commands.md).

## Template profiles

The extension ships two selectable presets that reshape the spec-kit pipeline: **`companion-standard`** (the stock commands, unchanged, with better timing baked in) and **`companion-lean`** (the same commands trimmed — no user-story section, lean plan, files/dependencies tasks). Both override the 7 pipeline commands (`specify`, `clarify`, `plan`, `tasks`, `analyze`, `implement`, `constitution`); `checklist` and `taskstoissues` stay on stock.

Pick a project default with the `speckit.companion.templateProfile` VS Code setting (`standard` | `lean` | `off`), which reconciles the two presets so only one is installed — activating the matching preset from the bundled path with no manual command. Override per spec from the spec's right-click menu. The four opt-in `/speckit.companion.*` commands above are the per-spec lean path; a `scripts/check-shape-parity.py` guard keeps them in lockstep with the `companion-lean` bodies, and asserts every body carries the shared timing partial. Full reference: [`../docs/template-profiles.md`](../docs/template-profiles.md).

## Installation

Requires a **github-source** spec-kit — the stock PyPI `specify-cli` has no `extension` subsystem:

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git --force
```

Then install the extension:

```bash
# From the release archive (recommended)
specify extension add companion --from https://github.com/alfredoperez/speckit-companion/releases/download/speckit-ext-v0.2.0/companion-0.2.0.zip

# Or from a local checkout while developing
specify extension add ./speckit-extension --dev
```

Once it lands in the spec-kit community catalog this shortens to `specify extension add companion`. `python3` is used by the capture scripts but is **optional** — capture skips gracefully if it's missing and never fails the host command. Full prerequisites + a CLI-less fallback: [docs/install.md](./docs/install.md).

Verify:

```bash
specify extension list        # `companion` present
# then run a real /speckit.specify and confirm specs/<NNN>/.spec-context.json is written
```

## How it works

```
/speckit.specify  →  after_specify hook  →  speckit.companion.capture
                                              →  write-context.py
                                              →  .spec-context.json  (append-only history[])  →  GUI lights up
```

Each lifecycle hook appends one entry to the canonical append-only `history[]` and advances `currentStep` / `status`. Inside implement, each completed `- [x] **T###**` task is journaled as a **substep** (so the viewer never mistakes a single task for the whole step finishing). When no hook fired, `derive-from-files.py` rebuilds the same shape from `spec.md` / `plan.md` / `tasks.md` + git, tagged `by: "derive"`. Full chain, the writer's guarantees, and the canonical schema: [docs/how-it-works.md](./docs/how-it-works.md).

## Docs & links

- [**SpecKit Companion (VS Code)**](https://marketplace.visualstudio.com/items?itemName=alfredo-dev.speckit-companion) — the GUI this feeds.
- [docs/install.md](./docs/install.md) — install (release / dev / fallback) + verification.
- [docs/commands.md](./docs/commands.md) — the commands and the hooks they run.
- [docs/how-it-works.md](./docs/how-it-works.md) — the hook → script → `.spec-context.json` chain and canonical schema.
- [docs/publishing.md](./docs/publishing.md) — how this extension is released to the spec-kit catalog (separate from the VS Code extension).
- [ROADMAP.md](./ROADMAP.md) — the migration plan and per-step status.
- [CHANGELOG.md](./CHANGELOG.md) — version history (independent of the VS Code extension).

## License

[MIT](./LICENSE) © alfredoperez. Independently maintained; not affiliated with the spec-kit core team.
