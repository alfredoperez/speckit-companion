# Changelog — SpecKit Companion spec-kit Extension

All notable changes to the **spec-kit extension** (`id: companion`) are documented here.

> This is **not** the VS Code extension. The spec-kit extension is versioned independently (`extension.yml` `version`); the VS Code GUI's changelog lives at the repo root: [`../CHANGELOG.md`](../CHANGELOG.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/); this extension follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Template profiles — `companion-standard` + `companion-lean` presets** (Step 4 of the v1 plan): two selectable presets, each overriding the 7 pipeline commands (`specify`, `clarify`, `plan`, `tasks`, `analyze`, `implement`, `constitution`; replace strategy — the spec-kit default). `companion-standard` is the stock command bodies, verbatim, with timing baked in; `companion-lean` is the trimmed shape — a spec with **no user-story section**, a lean plan, and tasks on a **files/dependencies** axis (smaller spec folder). Install with `specify preset add --dev ./speckit-extension/presets/companion-{standard,lean}`; the VS Code `speckit.companion.templateProfile` setting reconciles them so only one is installed (mutually exclusive).
- **Four opt-in `/speckit.companion.specify` / `.plan` / `.tasks` / `.implement` commands** — the per-spec lean path, emitting the lean shape regardless of the project's profile (declared in `extension.yml` `provides.commands`). A `scripts/check-shape-parity.py` guard keeps them in lockstep with the `companion-lean` bodies and asserts every body carries the shared timing partial.
- **Baked-in timing** in every command body (`presets/_shared/timing-partial.md`): per-step self-close, live `date -u` per substep/task, and per-task `complete` — so durations and cadence are accurate for any dispatcher, not just the GUI.
- **Duplicate-start dedup** in `write-context.py`: a repeated same-step `start` (e.g. GUI `startStep` + the `after_specify` hook both firing) now collapses instead of inflating `history[]`.

## [0.2.0] - 2026-06-07

Full lifecycle capture, derive-from-files fallback, and Status + Resume — Steps 2–3 of the v1 plan. First catalog release. See [ROADMAP.md](./ROADMAP.md).

### Added
- Status + Resume (Step 3 of the v1 plan): two user-invokable read commands. `speckit.companion.status` prints the active spec's current step, status, recorded decisions, and next action. `speckit.companion.resume` resolves the next step and dispatches the next `/speckit.*` command with decisions in scope — continuing at the next unchecked task inside the implement step, and reporting "Pipeline complete" on terminal states.
- New `status-context.py` (stdlib-only) read/resolve script: reads `.spec-context.json`, or derives state from on-disk files when it is missing/malformed (`source: derived`), and emits a `ResumeResolution` (human summary + machine `RESOLUTION:` JSON line). Prefers on-disk artifacts when recorded state disagrees with them (FR-011). Reuses `write-context.py` / `derive-from-files.py` for resolution and inference.
- Resume dispatches the already-installed `/speckit.*` commands and does not require a `specify workflow resume` CLI subcommand, so it works on the stock spec-kit version.
- Live per-task journaling on implement: the GUI's implement-step preamble now drives one live `history[]` entry per task (`substep`/`task` = task id, `by: "ai"`, real `date -u` timestamp) so per-task timing is real, not an end-of-run burst. `write-context.py --tasks-file` (the `after_implement` hook) dedupes on the `task` id and becomes a no-op backstop — covered by a new regression test.
- Full lifecycle capture: new `after_plan`, `after_tasks`, and `after_implement` lifecycle hooks (all auto-running, `optional: false`), each backed by a per-step capture command (`speckit.companion.capture-plan` / `-tasks` / `-implement`) that reuses `write-context.py`.
- Per-task journaling: `write-context.py` gains a `--tasks-file` task-sync mode that appends one idempotent `history[]` entry per completed `- [x] **T###**` marker (as an implement substep, so the viewer never reads it as a step completion); records `implementing` until all tasks are checked, then `implemented`.
- New `derive-from-files.py` (stdlib-only) reconstructs `.spec-context.json` from on-disk artifacts + git when a hook never fired, honoring the same no-backward-clobber guard and emitting the same canonical schema (`by: "derive"`).
- Added a stdlib `unittest` regression suite (append-only history, no-backward-clobber, unknown-key preservation, per-task idempotency/substep shape, legacy-`transitions`→`history` migration, derive round-trip).

### Changed
- The writer now appends to the canonical `history[]` field (with explicit `kind`) instead of the legacy `transitions[]`, and drops the derived `stepHistory` key — matching exactly what the VS Code GUI writes/reads. A pre-existing `transitions[]` array is migrated forward into `history[]` on the next write, so the extension and the GUI never deviate on field name.

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
