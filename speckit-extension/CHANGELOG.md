# Changelog — SpecKit Companion spec-kit Extension

All notable changes to the **spec-kit extension** (`id: companion`) are documented here.

> This is **not** the VS Code extension. The spec-kit extension is versioned independently (`extension.yml` `version`); the VS Code GUI's changelog lives at the repo root: [`../CHANGELOG.md`](../CHANGELOG.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/); this extension follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.11.0] - 2026-06-23

### Changed
- **Finishing a step and moving it forward now happens in one clean step.** When a pipeline step wraps up, marking it done and bumping the spec to its next status used to take a few separate calls plus a quick re-check to be sure nothing got recorded twice or out of order. That now happens as a single, safe action: the step is recorded as finished and the spec advances to the right status together, with no stray bookkeeping. Running it again changes nothing, and a spec that's already finished or archived is left untouched.
- **Re-running a spec folder no longer replays stale task progress.** When a spec is marked complete, the small per-task progress log it keeps while building is cleaned up — always after everything in it has been recorded, so nothing is ever lost. Before, that log lingered, and starting the same spec folder over could fold in finishes from the previous run. Behavior during a normal run is unchanged; this is an internal tidy-up surfaced by a code review, with no setting or command change.
- **The task list now shows which work is independent and where it has to wait.** Instead of scattered "can run in parallel" flags, each phase of the task list is laid out as ordered **waves** — a wave groups tasks that touch different files and don't depend on each other, and an explicit "wait for the wave above" line marks where the next group depends on the last. It reads clearly for a person and gives the assistant an honest dependency map to build against. Per-task notes (what each task did, which files) and the exact step-level timing are what the activity panel leans on; the per-task clock is best-effort, not a precise stopwatch.
- **Leaner plans — less boilerplate to read.** The plan no longer restates the project's known stack in a "Technical Context" block (your assistant already knows the codebase it's working in), and it stops writing a quickstart file that only repeated the obvious. Plans now lead with a plain-language summary, the constitution check, and the concrete file layout — the parts that actually shape the build. A genuinely non-obvious stack choice still gets a sentence in the summary.
- **Implementation logs progress without slowing down.** Recording each finished task used to rewrite the whole progress file every time, which the assistant sometimes had to retry and which quietly forced parallel work back into single file. Each finished task is now jotted down instantly to a side log and folded into the progress file in one pass after each batch, so the activity panel still keeps up while several tasks can genuinely build at the same time. Per-task timings stay just as accurate.
- **Finishing a task is the same action as logging it.** A task now records its own completion the instant its work is done, instead of the assistant doing a separate bookkeeping pass at the end of a phase — so the activity timeline reflects the real order and pace of the work rather than collapsing a whole phase into one moment. Checking the box in the task list is handled for you from that record, so when several tasks build at once none of them fight over the same file.
- **Companion output now mirrors stock spec-kit.** The `/speckit.companion.*` pipeline produces the familiar spec-kit shape: a spec with prioritized user stories, acceptance scenarios, key entities, and edge cases; a plan with a summary, a constitution check, the concrete file layout, and the design files (`research.md`, `data-model.md`, `contracts/`); and a task list grouped by user story into phases. Same readable shape you already know, with the Companion extras layered on top: lifecycle timing capture, size-based right-sizing, and automatic completion.

### Fixed
- **Progress tracking can no longer corrupt its own file.** When recording that a planning or task-generation step finished, the assistant used to edit the progress file by hand, which occasionally wrote a malformed file it then had to repair. Those finish marks now go through the same safe writer everything else uses, so the file stays valid every time.

### Added
- **Runs now finish on their own.** When the last task is done, the spec is marked completed automatically, so a run lands in Completed instead of stopping at "implemented" and waiting for a manual step.
- **Your installed spec-kit extensions keep working under Companion.** A Companion run now honors the same extension hooks a stock spec-kit run does, so the git extension (and any others you've installed) still fire at the start and end of each step — the branch-on-spec, the commit callouts, whatever they do. Previously those were silently skipped on the Companion pipeline. Companion's own customization hooks run on top of them, unchanged.

## [0.10.0] - 2026-06-16

### Added
- **The pipeline runs as fast as your assistant allows.** When your AI assistant can work on several things at once, the Companion steps now spread the work out: it reads different parts of the codebase side by side while investigating, flags which tasks are independent enough to run together, and builds those independent tasks at the same time during implementation. Assistants that can't do that simply run each step the usual one-at-a-time way and produce the exact same result — nothing to turn on, nothing breaks.
- **Point specific kinds of work at specialist helpers.** Implementation now leaves a clean place for a project to say "send test tasks to the testing specialist," so teams can route task types to dedicated helpers without changing the built-in steps.

## [0.9.0] - 2026-06-16

### Added
- **Build a whole spec hands-off with one command.** The new `/speckit.companion.auto` runs the entire pipeline end to end — from a description all the way to a finished, completed spec — without stopping for approval in between. It is the unattended sibling of the step-by-step flow and drives the very same per-step commands, so it can't drift from what they do. There's also a **Run** button in Create Spec that kicks off the same hands-off build from the editor.
- **Checkpoint hooks know when no one is watching.** Auto marks the run as unattended, and project checkpoint hooks ("Continue / Fix / Stop") can read that signal to record the checkpoint and keep going instead of waiting for a person. Background work, reviews, and PR steps still run — only the human pause is skipped. On a plain one-shot terminal, Run falls back to the normal one-step-at-a-time flow.

## [0.8.0] - 2026-06-15

### Added
- **Customize the pipeline without forking a command.** An optional project file (`.specify/companion.yml`) now lets you attach your own actions before or after any part of a Companion command — run a shell command, drop in an extra instruction, or call a reusable instruction file — and reorder which parts of a command run. If the file is absent, every command runs exactly as it ships. A worked example wires a full ship tail (review → PR → Copilot review → merge → reinstall) onto the end of a build; see `examples/ship-ticket/`.
- **A spec that's 100% done now finishes cleanly.** Marking a spec complete used to require it to have already settled into the "implemented" state; a spec sitting at "implementing" with every task checked off would refuse to complete. It now completes correctly the moment all its tasks are done, and finishing the last task no longer bumps a closing spec back to "implementing."

### Changed
- **Companion commands are now assembled from smaller, reusable parts.** Each command is built from a short ordered list of named sections rather than one hand-written file, which is what makes the customization above possible. This is a behind-the-scenes reshape — the commands you run are byte-for-byte identical to before, proven by a parity check in CI — so nothing about how they behave changes.
- **The timing rules stay in one place and can't quietly fork.** The shared timing instructions baked into every stock command are now guarded so they always come from the single shared copy — if a command ever pasted its own version of them, the build catches it. Editing the timing rules remains a one-place change that flows into every command. The commands you run are byte-for-byte unchanged.

## [0.7.0] - 2026-06-14

### Added
- **One step hands off to the next on agentic CLIs.** When you run a Companion step in an assistant that keeps working after a step finishes, it now reads the pipeline and continues into the next step on its own — pausing wherever the workflow asks you to review, and running a final "mark complete" step after implementation so the spec lands in **Completed**. In a plain or one-shot terminal nothing auto-advances: you drive the pipeline one step at a time, just as before, and completion stays a manual action. Stock SpecKit is unchanged and still stops at "implemented".

### Changed
- **Shared command logic is now written once.** How a change is sized (small vs. large), how the pipeline routes after sizing, and how timing is recorded each used to be repeated across several command files. Each now lives in exactly one shared block that the commands reuse, so changing a rule is a one-place edit instead of hunting through three files. The installed commands stay whole and self-contained — running one in a plain terminal still gives you a complete command, and a parity check proves the reshape changed no behavior.

## [0.6.0] - 2026-06-14

### Changed
- **One SpecKit Companion workflow, no more "standard vs. turbo" choice.** There used to be two advertised shapes — a "standard" profile and a "turbo" profile. In practice there was only ever one Companion workflow: the lean one. That lean shape is now the single Companion offering. The dead "turbo" preset is gone, and "turbo"/"standard" no longer appear as profile names in the commands or docs. Stock SpecKit is untouched — it's still the unchanged `/speckit.*` commands with better timing capture, available to everyone. If you ever installed the old turbo preset, it's cleaned up automatically on upgrade.
- **Small changes fast-track to implement automatically.** The right-sizing fast-path — which folds a small change straight to implement instead of running the full specify → plan → tasks pipeline — is now on by default. No flag to set. Larger changes (more than 5 files or 10 tasks, or a "bigger" scope signal) still run the full pipeline and print the guardrail warning, exactly as before; nothing is ever silently fast-tracked.

## [0.5.1] - 2026-06-14

### Fixed
- **Installs again on git/`uv` dev builds of spec-kit.** The 0.5.0 minimum was written as `>=0.9.5`, which — under Python's version rules — actually *excludes* the `0.9.5.devN` pre-release builds that `uv tool install --from git+…` produces (the exact install path the README recommends). The result was a `Compatibility Error: requires spec-kit >=0.9.5, but 0.9.5.dev0 is installed` on a correctly-set-up machine. The floor is now `>=0.9.5.dev0`, which accepts those dev builds and every 0.9.5+ release.

## [0.5.0] - 2026-06-13

### Added
- **The whole Companion pipeline is now one real workflow you run with a single command.** Instead of invoking specify, plan, tasks, and implement by hand, run `specify workflow run speckit-companion` (or point it at the workflow file directly) and spec-kit's engine drives the entire pipeline end to end — specify → plan → tasks → implement → mark-complete — **pausing at review gates** before planning and before tasks. Paused at a gate? `specify workflow resume <run_id>` picks up from the exact step it stopped at. Every step still feeds `.spec-context.json`, so the VS Code GUI lights up for both run and resume.
- **The run ends by marking the spec completed.** The workflow has a terminal step that writes `status: completed` once everything before it finishes — the explicit end-of-lifecycle the stock pipeline never had.
- **Built-in size routing, no on/off setting.** A routing node right-sizes the pipeline: a small change folds plan/tasks toward implement, a normal change runs the full pipeline with both gates, and an oversized change prints a visible warning and still runs the full pipeline — it never silently skips a phase. The ≤ 5-files / ≤ 10-tasks thresholds now live inside the workflow; there's no on/off toggle to set.

### Changed
- **Now requires spec-kit ≥ 0.9.5** — the release line that provides the workflow engine (`specify workflow run`/`resume`) the Companion workflow rides.

## [0.4.1] - 2026-06-12

### Fixed
- **Settling an implementation only ever updates the spec you point it at.** When recording implement progress, the capture now trusts the task list it's handed — the spec whose `tasks.md` you pass is the spec that gets updated — instead of whichever spec the workspace currently treats as "active." Previously, finishing one spec's implementation while a later spec was active could write the completion into the wrong spec and flip an unrelated spec to done. If a conflicting feature directory is also passed, the capture now refuses to write rather than guessing.

## [0.4.0] - 2026-06-12

### Changed
- **One stable install command that also updates you.** The install command now points at a permanent download URL that always serves the newest release, so you're no longer frozen on whatever version you happened to copy. Install with `specify extension add companion --from https://github.com/alfredoperez/speckit-companion/releases/download/companion-latest/companion.zip --force`, and **to update later, re-run the exact same line** — `--force` refreshes your installed copy in place. No version number to bump, no new URL to hunt down.

## [0.3.0] - 2026-06-10

The spec-kit extension's first catalog release — full lifecycle capture, Status + Resume, selectable template profiles, and accurate timing. See [ROADMAP.md](./ROADMAP.md).

### Added
- **Template profiles — standard and turbo, both always installed.** Two pipeline shapes you switch between with the `speckit.companion.templateProfile` VS Code setting (`standard` | `turbo` | `off`, default `off` — an opt-in beta). Standard runs the stock `/speckit.*` commands; turbo produces a trimmed shape — a spec with no user-story section, a trimmed plan, and tasks grouped by files/dependencies (a smaller spec folder). Switching is **non-destructive**: both command sets stay installed and the setting only routes which one a spec dispatches, so you never lose a command set or hit "Unknown command". Each spec pins the project default the moment it's created, so changing the setting reshapes only new specs, never one already in flight.
- **Four turbo commands — `/speckit.companion.specify` · `.plan` · `.tasks` · `.implement`.** The commands a turbo spec dispatches; always present alongside the stock `/speckit.*` family.
- **Complexity fast-path (turbo) — opt-in beta, off by default.** When enabled, `/speckit.companion.specify` classifies the change it just spec'd. A small change (projected ≤ 5 files / ≤ 10 tasks, no "larger" scope phrase) writes three lean files in one pass — `spec.md` (with an inline Approach), a `plan.md` pointer to it, and a real-checklist `tasks.md` — and folds plan and tasks into the same run, so the spec lands **ready-to-implement** in one pass instead of three (and the stepper/sidebar read the files as present, not "not created"; implement is the next user-triggered step). Larger changes keep the full pipeline; a change that crosses the 5-files / 10-tasks guardrail warns and runs the full pipeline rather than fast-tracking silently. Turn it on with `speckit.companion.complexityFastPath: true` (VS Code setting); it's mirrored into `.specify/companion.yml` for the command body to read.
- **Status + Resume.** `/speckit.companion.status` prints the active spec's current step, status, recorded decisions, and next action. `/speckit.companion.resume` continues the pipeline from the recorded step — and at the next unchecked task when mid-implementation — reporting "Pipeline complete" on terminal states. Works on stock spec-kit; no `specify workflow resume` subcommand required.
- **Full lifecycle capture.** The `after_plan`, `after_tasks`, and `after_implement` hooks record each step into `.spec-context.json` automatically, so the VS Code GUI always reflects the real pipeline state. When a hook never ran, the state is reconstructed from the on-disk artifacts and git history.
- **Accurate, script-written timing.** Per-step durations and per-task cadence are stamped by the capture scripts instead of being hand-authored by the AI, so they stay reliable across the terminal, IDE chat, and the GUI. `specify` records a real begin→end span, each implement task records a single finish event, and durations come from the gaps between finishes — no duplicate starts, `0s` ticks, or burst-stamped substeps. See [`../docs/capture-and-timing.md`](../docs/capture-and-timing.md).

### Changed
- **Resume dispatches the spec's own command family.** `/speckit.companion.resume` now resolves the next command from the family the spec has been running, read from its recorded `profile`: a turbo spec resumes with `/speckit.companion.<step>`, a stock spec with `/speckit.<step>`. This applies to every step resume can reach — plan, tasks, implement, finishing the current step, and the clarify/analyze fall-throughs — so the command shown in the terminal always matches the spec's flow. Specs with no recorded profile keep dispatching the stock `/speckit.*` commands, so stock-flow specs are unchanged.
- **Captured timing is now verified, and the records are leaner.** A run that dumps every task's completion in one end-of-step burst — instead of recording each task as it actually finishes — is caught and reported as a failure, where it previously passed as honest cadence. Every recorded event is checked against a fixed format, so a malformed or incomplete entry is flagged instead of silently accepted. The assistant is now instructed to journal each task the moment it completes. Records written by earlier versions keep working and rendering unchanged — nothing is rewritten on disk.
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
