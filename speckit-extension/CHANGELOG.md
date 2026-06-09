# Changelog — SpecKit Companion spec-kit Extension

All notable changes to the **spec-kit extension** (`id: companion`) are documented here.

> This is **not** the VS Code extension. The spec-kit extension is versioned independently (`extension.yml` `version`); the VS Code GUI's changelog lives at the repo root: [`../CHANGELOG.md`](../CHANGELOG.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/); this extension follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

The spec-kit extension's first catalog release — full lifecycle capture, Status + Resume, selectable template profiles, and accurate timing. See [ROADMAP.md](./ROADMAP.md).

### Added
- **Template profiles — standard and turbo, both always installed.** Two pipeline shapes you switch between with the `speckit.companion.templateProfile` VS Code setting (`standard` | `turbo` | `off`, default `standard`). Standard runs the stock `/speckit.*` commands; turbo produces a trimmed shape — a spec with no user-story section, a trimmed plan, and tasks grouped by files/dependencies (a smaller spec folder). Switching is **non-destructive**: both command sets stay installed and the setting only routes which one a spec dispatches, so you never lose a command set or hit "Unknown command". Each spec pins the project default the moment it's created, so changing the setting reshapes only new specs, never one already in flight.
- **Four turbo commands — `/speckit.companion.specify` · `.plan` · `.tasks` · `.implement`.** The commands a turbo spec dispatches; always present alongside the stock `/speckit.*` family.
- **Status + Resume.** `/speckit.companion.status` prints the active spec's current step, status, recorded decisions, and next action. `/speckit.companion.resume` continues the pipeline from the recorded step — and at the next unchecked task when mid-implementation — reporting "Pipeline complete" on terminal states. Works on stock spec-kit; no `specify workflow resume` subcommand required.
- **Full lifecycle capture.** The `after_plan`, `after_tasks`, and `after_implement` hooks record each step into `.spec-context.json` automatically, so the VS Code GUI always reflects the real pipeline state. When a hook never ran, the state is reconstructed from the on-disk artifacts and git history.
- **Accurate, script-written timing.** Per-step durations and per-task cadence are stamped by the capture scripts instead of being hand-authored by the AI, so they stay reliable across the terminal, IDE chat, and the GUI. `specify` records a real begin→end span, each implement task records a single finish event, and durations come from the gaps between finishes — no duplicate starts, `0s` ticks, or burst-stamped substeps. See [`../docs/capture-and-timing.md`](../docs/capture-and-timing.md).

### Changed
- **The trimmed profile is named "turbo".** The trimmed pipeline shape ships as `turbo` (preset `companion-turbo`); the pre-release working name "lean" was dropped before any release, so the old value is simply absent — nothing to migrate.
- Captured state is written in the canonical `.spec-context.json` shape the VS Code GUI reads, so the extension and the GUI never disagree; older files are migrated forward on the next write.
- **Turbo profile keeps the requirements checklist, and side files are created on demand.** The turbo `specify` again produces a `checklists/requirements.md` quality checklist — a trimmed version without the user-story / acceptance-scenario items, graded in a single self-check pass — instead of dropping it. And `plan`'s side files (`research.md`, `data-model.md`, `contracts/`, `quickstart.md`) are each created only when the file genuinely helps a developer understand or build *that* change, rather than by fixed "if entities / if interface" rules — so `research.md` and `quickstart.md` are no longer always dropped. The four-section spec (Overview + Functional Requirements + Success Criteria + Assumptions) and the files/dependencies task shape are unchanged. See [`../docs/template-profiles.md`](../docs/template-profiles.md).

### Fixed
- **Standard-profile specs now get per-task timing too.** Task capture only recognized the turbo/companion bold marker (`- [x] **T001**`) and silently skipped the standard tasks-template's plain markers (`- [x] T001`), so a standard-profile spec recorded no per-task progress and its implement step never auto-closed. Both marker formats are now detected.

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
