# Changelog — SpecKit Companion spec-kit Extension

All notable changes to the **spec-kit extension** (`id: companion`) are documented here.

> This is **not** the VS Code extension. The spec-kit extension is versioned independently (`extension.yml` `version`); the VS Code GUI's changelog lives at the repo root: [`../CHANGELOG.md`](../CHANGELOG.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/); this extension follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **The plan step picks its own blocks.** One deciding step adds call paths, code pins, states or screens, each checked, only when ==the change needs them==. ([#875](https://github.com/alfredoperez/speckit-companion/pull/875), [#905](https://github.com/alfredoperez/speckit-companion/pull/905)) <!-- area: pipeline -->
- **A risky small change takes the full pipeline.** Sizing asks whether a change is hard to undo or hard to check, and one that is ==never takes the short path==. ([#895](https://github.com/alfredoperez/speckit-companion/pull/895)) <!-- area: pipeline -->
- **A spec that finishes unverified says so.** Completing with nothing verified and no concern explaining why still completes, records =="finished, unverified"== and warns. ([#895](https://github.com/alfredoperez/speckit-companion/pull/895)) <!-- area: run-record -->
- **A run records its working branch.** A step started on another branch than the spec was created on records it, so the viewer ==names the right branch==. ([#895](https://github.com/alfredoperez/speckit-companion/pull/895)) <!-- area: run-record -->
- **The pipeline graph carries routing and living specs.** A verdict's skipped steps and the registered capabilities travel with the graph, so ==a panel can edit them==. ([#888](https://github.com/alfredoperez/speckit-companion/pull/888)) <!-- area: pipeline-builder -->

### Changed
- **Plain SpecKit commands stay untouched.** Stock runs are recorded through spec-kit's own hooks, so the `/speckit.*` commands are ==exactly what spec-kit ships==. ([#906](https://github.com/alfredoperez/speckit-companion/pull/906)) <!-- area: pipeline -->
- **Terminal runs of plain SpecKit get step times.** Each stock step records ==its own start== through a hook, and the task list fills only when VS Code sends the step. ([#906](https://github.com/alfredoperez/speckit-companion/pull/906)) <!-- area: run-record -->
- **The plan step records its check.** Closing the plan step records its block check with an exit code, so ==the result is always kept==. ([#905](https://github.com/alfredoperez/speckit-companion/pull/904)) <!-- area: pipeline -->

### Fixed
- **A registry rewrite keeps the chosen layout.** Registering a capability re-emits the registry, which dropped `layout` and sent ==every later adoption back to asking==. ([#888](https://github.com/alfredoperez/speckit-companion/pull/888)) <!-- area: living-specs -->
- **Finished work is recorded right.** The manual check keeps its result, and a completed spec ==names no current task==. ([#882](https://github.com/alfredoperez/speckit-companion/pull/882)) <!-- area: run-record -->

## [0.24.0] - 2026-10-03

Spec Kit's converge step now lands in the run record, and a hook moves in one write.

### Highlights

#### Spec Kit's converge step is recorded
Running `/speckit.converge` used to leave no trace in the run record, because converge was not a step it knew. Two new hooks now record when converge starts and finishes, so its time shows beside the other steps. Converge never changes the spec's status, a spec that ran it can still be marked complete, and the status command points at the next task when converge added some.
<!-- area: run-record; pr: 813 -->

### Added
- **A hook moves in one write.** The configuration writer can now move a hook to another place, or up and down among the hooks at one place, as a single change. The hook keeps the text it was written with, every other line of the file stays as it was, and a move to a node or phase the step does not have is refused with nothing written. Before this a move was a removal and then an addition, so an addition that was refused left the hook gone. ([#818](https://github.com/alfredoperez/speckit-companion/pull/818)) <!-- area: pipeline-builder -->

### Fixed
- **The capture and quality evals time a step to its own finish.** They measured a step up to the next step's start, so a spec left idle for an hour between specify and plan reported the wait as specify's time. The step timing line now lists each step's own duration, or says it was not measured, and a finish recorded more than once counts only the first trusted one. A step the editor started and the assistant finished through the recorder now counts as measured. ([#804](https://github.com/alfredoperez/speckit-companion/pull/804)) <!-- area: run-record -->

## [0.23.0] - 2026-09-30

### Added
- **A run that never read the living specs now says so.** Loading them never fails by design, so a skipped load looked exactly like a project with nothing to load, and the run carried on without the context every other run gets. The health check reports it as a problem. ([#781](https://github.com/alfredoperez/speckit-companion/pull/781))

### Changed
- **Adoption checks its own output before it reports.** A drafted spec that fails the project's own shape check is not a draft, and the check was only ever run afterwards, by hand, if at all. ([#781](https://github.com/alfredoperez/speckit-companion/pull/781))
- **An area with only conventions no longer becomes a capability.** It had no requirements, so every run loaded it to learn nothing, and it existed only to give the conventions a second home. ([#781](https://github.com/alfredoperez/speckit-companion/pull/781))
- **Adopting an area writes one spec, not a spec and a rules file.** The conventions a rules file held are already in `CLAUDE.md` and in the linters that enforce them, and a second copy is one that can disagree with the first. A rules file an earlier run wrote is still read. ([#781](https://github.com/alfredoperez/speckit-companion/pull/781))
- **Every adopted requirement keeps a scenario.** Trimming for brevity was cutting the one part a reader can check against the code, and the part that maps a requirement to a test. ([#781](https://github.com/alfredoperez/speckit-companion/pull/781))
- **A step's internal timings are recorded as they happen.** Stamping them together at the end read as zero seconds each, which cost a write and measured nothing. ([#781](https://github.com/alfredoperez/speckit-companion/pull/781))
- **Adoption looks for what the code guards against, not only what it does.** A test named for a defect, a `Fixed` changelog entry, a guard with no obvious caller: each is a past bug the code alone cannot explain, and each now becomes a requirement rather than being read straight past. ([#779](https://github.com/alfredoperez/speckit-companion/pull/779))
- **A requirement says what a person gets, not what the product looks up.** "A reader sees the site in the language they chose" instead of a resolution order over a settings key. ([#779](https://github.com/alfredoperez/speckit-companion/pull/779))
- **A rule that binds every capability gets a capability of its own.** Escaping what a person typed before it reaches a screen belongs to no single area, so every draft used to drop it and it ended up written nowhere. ([#779](https://github.com/alfredoperez/speckit-companion/pull/779))
- **Deferrals are checked before the run ends.** When one draft says another capability owns something, adoption now opens that spec and confirms it, instead of leaving the behaviour written nowhere. ([#779](https://github.com/alfredoperez/speckit-companion/pull/779))
- **Living specs stay short on purpose.** Adopting a code area now tests each requirement with one question, would someone planning a change here need this, and lists what it left out as *found, not proposed* so you can pull any of it back. At the end of a run, a new file no spec claims no longer forces a new capability: supporting code gets no requirement, and only something a person can now do gets one. ([#779](https://github.com/alfredoperez/speckit-companion/pull/779))
- **Living-spec validation and coverage checks run in about a tenth of the time.**
- **Living-spec changes are reviewed before they land.** A living spec is context every later run loads, so what folds into it is now read by someone other than its author. Before the fold, implement hands the new and changed requirements to one reviewer with a short rubric: every requirement names behaviour someone relies on, one rule per requirement, a heading someone could check, behaviour rather than how it is built, and no filler. The reviewer edits them in place, and the doctor warns when a run folded without it. ([#765](https://github.com/alfredoperez/speckit-companion/pull/765))
- **`living-validate` flags requirements that are hard to hold.** It now warns when one requirement bundles more than four rules, when it takes more than 120 words to state its rule, and when a spec drafted from the code still carries its draft banner. A spec is now too large by its length alone, past 160 lines: it no longer warns past eight requirements, since splitting bundled rules raises the count without making the spec harder to read.
- **A large shared foundation is built by several workers.** Implement used to build the whole Foundational phase itself. Each Foundational wave of four or more independent tasks now goes to up to four workers at once, and the next wave starts only when they have all returned. Smaller waves, Setup and Polish still run in the main agent. The doctor warns when a finished implement skipped those workers, and it no longer faults a small fast-path run for plan readers it never had. ([#762](https://github.com/alfredoperez/speckit-companion/pull/762))
- **An auto run now hands work to parallel workers.** Implement used to build every story inline whenever the whole pipeline ran in one session, which is every auto run. It now sends each story with five or more files to its own worker, the same as a step run on its own. Plan no longer decides for itself whether to send workers: a script prints one reader brief per code area and one writer brief per design document, and plan sends them as printed. Each worker checks in, and the doctor warns when a finished plan had briefs and nobody checked in. ([#758](https://github.com/alfredoperez/speckit-companion/pull/758))
- **Implement's closing record is its own step.** Recording what was verified, decided and left open now runs as a separate node after the work and its checks. Hooks attached after the work still run after the checks, as before. ([#758](https://github.com/alfredoperez/speckit-companion/pull/758))

### Fixed
- **`write-context.py` refuses an unscoped specify write against a finished spec.** With no `--feature-dir`, the writer follows `.specify/feature.json`, which still points at the previous spec until the stock command creates the new folder. It printed "not regressing" and exited 0, so a transcript read as success while the new spec was never closed. It now exits 2 and names the flag to pass. ([#787](https://github.com/alfredoperez/speckit-companion/pull/787))
- **Auto no longer re-runs plan and tasks that specify already folded.** On a `simple` verdict specify writes the lean `plan.md` and `tasks.md` and records both steps, but auto and the workflow's `simple` route dispatched plan and tasks anyway, overwriting the lean files and spending minutes on steps the fold had finished in seconds. Both now read the verdict and go straight to implement. ([#787](https://github.com/alfredoperez/speckit-companion/pull/787))
- **The doctor stops warning about steps a Companion run closes itself.** Plan, tasks and implement closed by the assistant are how a Companion run works, including older specs on the turbo profile, so they are no longer reported as closed by the wrong writer. ([#764](https://github.com/alfredoperez/speckit-companion/pull/764))
- **A dispatch time given in another time zone is stored in UTC.** A step start passed with an offset or without milliseconds could sort out of order against every other stamp. ([#764](https://github.com/alfredoperez/speckit-companion/pull/764))
- **A folded requirement lands under Requirements.** When a feature added a requirement to a living spec that ends with another section, such as Uncovered, the fold put it after that section, where the requirement tools do not read it. It now goes at the end of the Requirements section. ([#763](https://github.com/alfredoperez/speckit-companion/pull/763))
- **The doctor no longer blames a run for an older failure.** A failed capture call from before a run's window used to be reported as a problem for that run. It is now a note saying failures from other runs sit in the shared log. ([#757](https://github.com/alfredoperez/speckit-companion/pull/757))
- **The doctor finds a spec file named after the feature.** A step that declares it writes `<short-name>.spec.md` was reported as closing without it, because the check looked for that literal file name. It now matches the file the run actually named. ([#757](https://github.com/alfredoperez/speckit-companion/pull/757))
- **Coverage records a list of names, whichever way it was written.** A requirement's tasks and tests given as one comma-separated line are stored as separate names, the same as when they are passed one flag at a time. Written as a single line, they read back as no coverage at all. ([#746](https://github.com/alfredoperez/speckit-companion/pull/746))
- **A requirement removed on purpose is not reported missing.** When the viewer records a removal beside a living spec, `/speckit.companion.living-validate` no longer warns that a change names a heading the spec does not have. ([#746](https://github.com/alfredoperez/speckit-companion/pull/746))

### Added
- **Ask what leans on a requirement.** `resolve-spec-paths.py --leaned-on-by <capability>#<heading>` lists every requirement whose aligns link names that heading, in any capability, with its files and body. Plain output prints one `capability#heading` per line. ([#746](https://github.com/alfredoperez/speckit-companion/pull/746))

Older releases (0.22.0 and earlier) are archived in [`apps/website/src/data/changelog-archive-speckit.md`](../website/src/data/changelog-archive-speckit.md), and the full history reads at [speckit-companion.dev/changelog](https://speckit-companion.dev/changelog).
