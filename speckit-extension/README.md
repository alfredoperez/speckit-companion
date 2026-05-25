# SpecKit Companion — spec-kit Extension

Make your spec-driven work **visible**. This is the spec-kit-side half of [SpecKit Companion](https://github.com/alfredoperez/speckit-companion) (`id: companion`): it records your spec-kit lifecycle activity into `.spec-context.json` so the **SpecKit Companion VS Code GUI lights up on your existing spec-kit flow** — no template change, no GUI code change.

> **Status:** v1 foundation shipped & proven. See **[ROADMAP.md](./ROADMAP.md)** for the full 8-step plan and per-step status.

## Why install it

- **Live progress in the GUI** — each spec-kit step (specify → … → implement) appears in the Companion sidebar as it happens, with status and history.
- **Zero workflow change** — it rides your *existing* spec-kit commands via lifecycle hooks; there are no new commands to learn to get tracking.
- **Agent-agnostic** — works wherever spec-kit runs (Claude Code, Copilot, Cursor, Gemini, …), with extra depth on Claude.
- **Safe by design** — writes are atomic and append-only, preserve your data, never regress a shipped spec, and never fail your spec-kit command.
- **More coming** — status/resume, an opinionated pipeline + preset, living-specs & drift, and auto-mode (see the [roadmap](./ROADMAP.md)).

## Quick start

Requires a **github-source** spec-kit (the stock PyPI `specify-cli` has no `extension` CLI). From the repo root:

```bash
specify extension add ./speckit-extension --dev
```

Then run your normal `/speckit.specify` — the Companion sidebar updates. Full prerequisites, catalog install, and a CLI-less fallback are in **[docs/install.md](./docs/install.md)**.

## Docs

- **[docs/install.md](./docs/install.md)** — install (dev / catalog / fallback) + verification.
- **[docs/commands.md](./docs/commands.md)** — the commands and the lifecycle hooks they run.
- **[docs/how-it-works.md](./docs/how-it-works.md)** — the hook → script → `.spec-context.json` chain, the writer's guarantees, the canonical schema, and the end-to-end proof.
- **[docs/contributing.md](./docs/contributing.md)** — dev loop for building the next steps (this is the *spec-kit* extension, separate from the VS Code one).
- **[ROADMAP.md](./ROADMAP.md)** — the 8-step migration plan and status.
- **[CHANGELOG.md](./CHANGELOG.md)** — version history (independent of the VS Code extension).

---

It lives beside the VS Code extension in the monorepo and is published/installed independently; it does **not** read or depend on the GUI at runtime — it only writes the canonical `.spec-context.json` the GUI already consumes.
