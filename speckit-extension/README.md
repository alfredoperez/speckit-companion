<p align="center">
  <img src="https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/speckit-extension/assets/hero.jpg" alt="SpecKit Companion — spec-kit extension" width="100%">
</p>

<h1 align="center">SpecKit Companion — spec-kit Extension</h1>

<p align="center">
  <strong>Make your spec-driven work visible.</strong> Captures your spec-kit lifecycle into <code>.spec-context.json</code> so the SpecKit Companion VS Code GUI lights up on your existing flow — plus <code>status</code> &amp; <code>resume</code> to pick up where you left off.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/extension-companion-0b6dd9" alt="extension: companion">
  <img src="https://img.shields.io/badge/version-0.3.0-0b6dd9" alt="version 0.3.0">
  <img src="https://img.shields.io/badge/spec--kit-%E2%89%A50.8.5-008080" alt="requires spec-kit >= 0.8.5">
  <img src="https://img.shields.io/badge/license-MIT-gold" alt="license MIT">
</p>

```bash
specify extension add companion --from https://github.com/alfredoperez/speckit-companion/releases/download/speckit-ext-v0.3.0/companion-0.3.0.zip
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

## Stock spec-kit vs + SpecKit Companion

| Capability | Stock spec-kit | + SpecKit Companion |
|---|:---:|:---:|
| Spec-driven pipeline (`specify` → `plan` → `tasks` → `implement`) | ✅ | ✅ |
| Runs across agents (Claude, Copilot, Cursor, Gemini, …) | ✅ | ✅ |
| Live progress in the VS Code GUI (sidebar + status badges) | ❌ | ✅ |
| Per-task history during implement | ❌ | ✅ |
| `status` — where does this spec stand right now? | ❌ | ✅ |
| `resume` — pick up exactly where you left off | ❌ | ✅ |
| Lean "turbo" pipeline shape (no user stories, trimmed plan/tasks) | ❌ | ✅ |
| Complexity fast-path — right-size the ceremony to the change | ❌ | ✅ (beta) |
| Honest state recovery when a lifecycle hook didn't fire | ❌ | ✅ |

Companion rides your **existing** spec-kit commands via lifecycle hooks — you get the whole right-hand column with **zero workflow change**.

## What you get

| Capability | Status | What it gives you |
|---|---|---|
| **Lifecycle progress capture** | ✅ Shipped | Every spec-kit step (specify → plan → tasks → implement) is recorded into `.spec-context.json` as it happens — the GUI lights up on your existing flow, no new commands. |
| **Per-task implement history** | ✅ Shipped | Implement journals each task as it completes, so the GUI shows real per-task progress, not just "in progress." |
| **Honest state recovery** | ✅ Shipped | When a hook didn't fire, `derive-from-files.py` reconstructs state from the artifacts on disk — the GUI reflects reality, never a half-truth. |
| **`/speckit.companion.status`** | ✅ Shipped | One command prints where the active spec stands — step, status, recorded decisions, and the next action. |
| **`/speckit.companion.resume`** | ✅ Shipped | Pick up where you left off — carries recorded decisions into scope and dispatches the next command in the family the spec has been running. |
| **Template profiles** ([standard / turbo](../docs/template-profiles.md)) | ✅ Shipped | Pick your pipeline shape: stock `/speckit.*` with better timing, or lean `/speckit.companion.*` (no user stories, trimmed plan, files/dependencies tasks). Both always installed; switching is non-destructive. |
| **Complexity fast-path** ([turbo](../docs/template-profiles.md#complexity-fast-path-turbo-only)) | 🧪 Beta | Right-sizes the ceremony to the change — small edits fold specify+plan+tasks into one pass; larger changes keep the full pipeline. Off by default. |
| **Agent-agnostic, safe by design** | ✅ Shipped | Runs wherever spec-kit runs (Claude, Copilot, Cursor, Gemini, …). Writes are atomic, append-only, never regress a shipped spec, and never fail your command; stdlib-only Python. |

## Commands

Four capture commands run automatically as lifecycle hooks; two are yours to run.

| Command | Runs | What it does |
|---------|------|--------------|
| `speckit.companion.capture` | `after_specify` hook | Record specify completion into `.spec-context.json` |
| `speckit.companion.capture-plan` | `after_plan` hook | Record plan completion (`planned`) |
| `speckit.companion.capture-tasks` | `after_tasks` hook | Record tasks completion (`ready-to-implement`) |
| `speckit.companion.capture-implement` | `after_implement` hook | Per-task journaling on implement (`implemented` when all tasks checked) |
| `/speckit.companion.status` | you | Print the current step, status, recorded decisions, and the next action |
| `/speckit.companion.resume` | you | Continue the pipeline from the recorded step — carries decisions into scope and dispatches the next command in the family the spec has been running (`/speckit.companion.<step>` for turbo specs, `/speckit.<step>` for stock specs; at the next unchecked task inside implement) |
| `/speckit.companion.specify` · `.plan` · `.tasks` · `.implement` | you | Opt-in turbo pipeline — emit the turbo shape (no user stories, trimmed plan, files/dependencies tasks) for one spec, regardless of the project's profile |

Full reference: [docs/commands.md](./docs/commands.md).

## Template profiles — pick your pipeline shape

SpecKit Companion offers two pipeline shapes, and **both are always installed at the same time** — choosing one never deletes the other:

- **Standard** — the stock `/speckit.specify · plan · tasks · implement` commands, unchanged, with better timing capture. Closest to upstream spec-kit.
- **Turbo** — the `/speckit.companion.specify · plan · tasks · implement` commands: a trimmed shape with no user-story section, a trimmed plan, files/dependencies tasks, and a smaller spec folder.

**How to switch:** set the `speckit.companion.templateProfile` VS Code setting to `standard`, `turbo`, or `off` (the default — it's an opt-in beta, so the profiles are off until you pick one). That's the only place the choice is made. Switching is **non-destructive** — neither command set is removed or overwritten, so you never lose your commands or hit "Unknown command" (the standard family is re-added automatically if a project is ever missing it). Each spec pins the project default the moment it's created, so flipping the setting later reshapes only *new* specs, never one that's already underway.

`off` is an escape hatch that routes to the stock commands and skips the Companion install/repair step (it won't remove `companion-standard` if a prior setting already installed it). Under the hood the stock family stays present via an add-only activation step that also recovers a project whose commands a prior version may have stranded; a `scripts/check-shape-parity.py` guard keeps the turbo commands in lockstep with their bodies and asserts every body carries the shared timing partial. Full reference: [`../docs/template-profiles.md`](../docs/template-profiles.md).

### Complexity fast-path (turbo)

Turbo can right-size the ceremony to the change. This is an **opt-in beta** — it's **off by default**. When enabled, `/speckit.companion.specify` classifies the drafted spec: a small change (projected ≤ 5 files / ≤ 10 tasks, with no "larger" scope phrase) writes three lean files in one pass — `spec.md` with an inline **Approach**, a **`plan.md`** pointer to it, and a real-checklist **`tasks.md`** — and folds plan and tasks into the same run, so the spec lands **ready-to-implement** in one pass instead of three (the file-driven stepper and sidebar read the files as present, not "not created"; implement is the next user-triggered step). Larger changes keep the full specify → plan → tasks → implement pipeline; a change that crosses the 5-files / 10-tasks guardrail prints a warning and runs the full pipeline rather than fast-tracking silently. Enable it with `speckit.companion.complexityFastPath: true` (VS Code setting); the extension mirrors that into `complexityFastPath` in `.specify/companion.yml` — a machine-local cache the command body reads, so the VS Code setting is the single source of truth. Full reference: [`../docs/template-profiles.md`](../docs/template-profiles.md#complexity-fast-path-turbo-only).

## Installation

Requires a **github-source** spec-kit — the stock PyPI `specify-cli` has no `extension` subsystem:

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git --force
```

Then install the extension:

```bash
# From the release archive (recommended)
specify extension add companion --from https://github.com/alfredoperez/speckit-companion/releases/download/speckit-ext-v0.3.0/companion-0.3.0.zip

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
