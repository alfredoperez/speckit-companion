# Changelog — SpecKit Companion spec-kit Extension

All notable changes to the **spec-kit extension** (`id: companion`) are documented here.

> This is **not** the VS Code extension. The spec-kit extension is versioned independently (`extension.yml` `version`); the VS Code GUI's changelog lives at the repo root: [`../CHANGELOG.md`](../CHANGELOG.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/); this extension follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- **Hands-off runs cost less.** An auto run makes ==fewer bookkeeping calls== and carries fewer instructions, closing the gap to stock on harder work. ([#1000](https://github.com/alfredoperez/speckit-companion/pull/1000)) <!-- area: pipeline -->
- **Size is decided before the spec.** A change you understand, with nothing risky in it, ==goes straight to implement== whatever its file count. ([#1000](https://github.com/alfredoperez/speckit-companion/pull/1000)) <!-- area: pipeline -->
- **Every requirement gets a test task.** The task list plans one test per requirement, checked ==through the screen or API== in the condition it names. ([#1000](https://github.com/alfredoperez/speckit-companion/pull/1000)) <!-- area: pipeline -->
- **No more checklist file.** Specify checks the spec once and fixes it in place, without writing ==checklists/requirements.md==. ([#1000](https://github.com/alfredoperez/speckit-companion/pull/1000)) <!-- area: pipeline -->
- **Task times come per wave.** A wave of tasks closes in one step, so the viewer shows ==one time per wave==. ([#1000](https://github.com/alfredoperez/speckit-companion/pull/1000)) <!-- area: run-record -->

### Fixed
- **Receipts catch every code edit.** A check reads ==out of date== even when the edit lands in the same second as the commit. <!-- area: run-record -->
- **Specs finish at Completed.** A run ==no longer stops at Implemented== when converge adds and builds work or closes without its hook. ([#1000](https://github.com/alfredoperez/speckit-companion/pull/1000)) <!-- area: pipeline -->

## [0.26.0] - 2026-11-08

Companion lines up with Spec Kit 1.2.5, and every spec records what was proven, assumed or only claimed.

### Added
- **Doctor checks agents and numbers; status is scripted.** It flags ==missing Companion commands==, a missing `specify` CLI and shared spec numbers, and status prints the record on any console. ([#951](https://github.com/alfredoperez/speckit-companion/pull/951), [#971](https://github.com/alfredoperez/speckit-companion/pull/971), [#975](https://github.com/alfredoperez/speckit-companion/pull/975)) <!-- area: install -->
- **A spec keeps its ticket, request and assumptions.** It keeps ==your request verbatim==, decision authors, assumptions, each check's commit, a risk tier, mutation results, and PR receipts. ([#945](https://github.com/alfredoperez/speckit-companion/pull/945), [#964](https://github.com/alfredoperez/speckit-companion/pull/964), [#965](https://github.com/alfredoperez/speckit-companion/pull/965), [#966](https://github.com/alfredoperez/speckit-companion/pull/966), [#967](https://github.com/alfredoperez/speckit-companion/pull/967), [#968](https://github.com/alfredoperez/speckit-companion/pull/968), [#969](https://github.com/alfredoperez/speckit-companion/pull/969)) <!-- area: run-record -->
- **Step times from the agent itself.** Typing a step command records its start, and a turn closes the step only when its document is really written. ([#939](https://github.com/alfredoperez/speckit-companion/pull/939)) <!-- area: run-record -->

### Changed
- **Only a clean converge completes a spec.** A converge that adds no task completes the spec, ==each pass records the tasks it added==, and auto stops after three. ([#940](https://github.com/alfredoperez/speckit-companion/pull/940), [#942](https://github.com/alfredoperez/speckit-companion/pull/942), [#944](https://github.com/alfredoperez/speckit-companion/pull/944)) <!-- area: pipeline -->
- **New specs are `spec.md`.** Companion writes new specs as `spec.md`, so stock converge, analyze and clarify find them, and older named specs still open. ([#941](https://github.com/alfredoperez/speckit-companion/pull/941)) <!-- area: pipeline -->

### Fixed
- **No stray `.gitignore` when the trace is ignored.** The run trace writes its per-spec `.gitignore` only when ==no existing git rule== covers `.trace.jsonl`, as its docstring said. ([#962](https://github.com/alfredoperez/speckit-companion/pull/962)) <!-- area: run-record -->
- **Two specs never share a number.** One step picks the next folder ==under a lock== and follows your `feature_numbering`, timestamp or sequential. ([#954](https://github.com/alfredoperez/speckit-companion/pull/954)) <!-- area: pipeline -->
- **Copilot gets the built pipeline.** A build refreshes the skills ==in `.github/skills/`== too, so Copilot runs the project's pipeline. ([#950](https://github.com/alfredoperez/speckit-companion/pull/950)) <!-- area: pipeline -->
- **Monorepo projects record their runs.** The writer finds the project ==the way Spec Kit does==, from the nearest `.specify/` up, and the feature pointer outranks the label. ([#949](https://github.com/alfredoperez/speckit-companion/pull/949)) <!-- area: run-record -->
- **Hook pages are one line each.** Each hook that records a plain spec-kit step runs one command, and a broken `.specify/extensions.yml` is reported, not skipped. ([#938](https://github.com/alfredoperez/speckit-companion/pull/938)) <!-- area: run-record -->
- **Your team's templates shape Companion runs too.** Template overrides and presets shape Companion runs on ==Spec Kit 1.2.5== or newer, without touching stock runs. ([#937](https://github.com/alfredoperez/speckit-companion/pull/937), [#980](https://github.com/alfredoperez/speckit-companion/pull/980)) <!-- area: pipeline -->
- **The run record stays whole.** A small spec's plan and tasks land in one write, a status never moves back, and a damaged record is ==kept aside==. ([#936](https://github.com/alfredoperez/speckit-companion/pull/936), [#970](https://github.com/alfredoperez/speckit-companion/pull/970)) <!-- area: run-record -->

## [0.25.0] - 2026-10-13

The plan step draws what a change touches, and plain Spec Kit commands are left exactly as shipped.

### Highlights

#### The plan draws its blocks
One deciding step adds call paths, pinned code, states or screens to the plan ==only when the change needs them==, and checks each one: every file and line resolves, every state is reachable, every screen dot has its note.
<!-- area: pipeline; pr: 875, 905 -->

#### Plain Spec Kit commands stay untouched
Stock runs are recorded through spec-kit's own hooks, so the `/speckit.*` commands are ==exactly what spec-kit ships==, and a terminal run of plain Spec Kit still gets its step times.
<!-- area: pipeline; pr: 906 -->

### Added
- **A risky small change takes the full pipeline.** Sizing asks whether a change is hard to undo or hard to check, and one that is ==never takes the short path==. ([#895](https://github.com/alfredoperez/speckit-companion/pull/895)) <!-- area: pipeline -->
- **A spec that finishes unverified says so.** Completing with nothing verified and no concern explaining why still completes, records =="finished, unverified"== and warns. ([#895](https://github.com/alfredoperez/speckit-companion/pull/895)) <!-- area: run-record -->
- **A run records its working branch.** A step started on another branch than the spec was created on records it, so the viewer ==names the right branch==. ([#895](https://github.com/alfredoperez/speckit-companion/pull/895)) <!-- area: run-record -->
- **The configuration writer sets a verdict's routing.** A verdict's skipped steps and its notice are written together, and removing the entry ==restores the declared routing==. ([#888](https://github.com/alfredoperez/speckit-companion/pull/888)) <!-- area: pipeline-builder -->
- **Living specs travel with the pipeline graph.** The graph carries whether they run, where specs live and ==which capabilities are registered==, so a panel can draw them. ([#888](https://github.com/alfredoperez/speckit-companion/pull/888)) <!-- area: living-specs -->

### Changed
- **Terminal runs of plain SpecKit list no tasks.** The viewer's task list fills ==only when VS Code sends the step==. ([#906](https://github.com/alfredoperez/speckit-companion/pull/906)) <!-- area: run-record -->
- **The plan step records its check.** Closing the plan step records its block check with an exit code, so ==the result is always kept==. ([#905](https://github.com/alfredoperez/speckit-companion/pull/904)) <!-- area: pipeline -->

### Fixed
- **A registry rewrite keeps the chosen layout.** Registering a capability re-emits the registry, which dropped `layout` and sent ==every later adoption back to asking==. ([#888](https://github.com/alfredoperez/speckit-companion/pull/888)) <!-- area: living-specs -->
- **The manual check records its result.** The brownfield preset's click-through step called the recorder with `--concerns`, a flag that does not exist, so the result was dropped. ([#882](https://github.com/alfredoperez/speckit-companion/pull/882)) <!-- area: run-record -->
- **A completed spec names no current task.** Marking a spec complete clears the current task, which had kept naming the last one finished. ([#882](https://github.com/alfredoperez/speckit-companion/pull/882)) <!-- area: run-record -->
