# Changelog — SpecKit Companion spec-kit Extension

All notable changes to the **spec-kit extension** (`id: companion`) are documented here.

> This is **not** the VS Code extension. The spec-kit extension is versioned independently (`extension.yml` `version`); the VS Code GUI's changelog lives at the repo root: [`../CHANGELOG.md`](../CHANGELOG.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/); this extension follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-05-25

Foundation + state-write spike — the v1 first slice (PR #173). See [ROADMAP.md](./ROADMAP.md).

### Added
- `extension.yml` manifest (`id: companion`) registering one `after_specify` lifecycle hook and the `speckit.companion.capture` command — mirrors spec-kit's bundled `git` extension shape.
- `commands/speckit.companion.capture.md` — the command-markdown the hook runs.
- `scripts/write-context.py` — a stdlib-only writer that captures spec-kit activity into the canonical `.spec-context.json` (`currentStep`/`status` + append-only `transitions` with `by: extension`). Crash-safe (atomic temp+rename), preserves unknown top-level keys, never regresses a more-advanced/shipped spec, never emits the legacy `currentStep: "done"`.
- Docs: `README.md`, `ROADMAP.md` (8-step plan), and `docs/` (install, commands, how-it-works, contributing).

### Changed
- Aligned the canonical schema `src/core/types/spec-context.schema.json` `status` enum (added `implemented`) so terminal state matches the TypeScript `Status` type.

### Verified
- End-to-end (2026-05-25): a real `/speckit.specify` auto-fired the `after_specify` hook (`optional: false`, no nudge) and wrote a canonical `.spec-context.json` with `workflow: "speckit"` on a plain spec-kit flow.
