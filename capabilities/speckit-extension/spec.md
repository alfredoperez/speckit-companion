# SpecKit Extension — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

`speckit-extension/` is this repo's second product: a spec-kit extension (`id: companion`) that installs into a user's spec-kit workspace and adds lifecycle capture, right-sized routing, and a terminal completion step to the spec-driven pipeline. Without it the VS Code extension has nothing to read — no `.spec-context.json` is written, no spec ever reaches a completed state, and the GUI shows a pipeline it cannot observe.

## Requirements

### The extension is an independently versioned product with its own manifest, docs, and release flow

`speckit-extension/` MUST carry its own version, README, and CHANGELOG, declared and dated independently of the VS Code extension's. A change confined to this directory MUST update this product's docs and MUST NOT touch the repo-root README, CHANGELOG, or `package.json`.

#### Scenario: a change lands under the extension directory
- **WHEN** a contributor changes a command, script, hook, or the manifest under `speckit-extension/`
- **THEN** the extension's own README and CHANGELOG are the documents updated
- **AND** the root product's docs and version are left untouched

#### Scenario: a feature spans both products
- **WHEN** one user-visible capability has a GUI half and an extension half
- **THEN** each product's changelog describes only its own half
- **AND** the overlap between the two entries is expected rather than deduplicated

### The manifest is the installation contract for every capability the extension exposes

`extension.yml` SHALL be the single declaration of what an install materializes — the extension identity, the spec-kit version floor, the commands, and the lifecycle hook bindings. Any capability not declared there MUST be treated as absent from an installed extension, regardless of what exists in the source tree.

#### Scenario: a capability exists on disk but is undeclared
- **WHEN** a command body or hook is added to the source tree without a corresponding manifest entry
- **THEN** the installer skips it and users never receive it
- **AND** the gap is a defect in the change, not a later cleanup

#### Scenario: a declared entry points at nothing
- **WHEN** the manifest names a command file that has been renamed or deleted
- **THEN** the packaging gate fails and names the missing file

### The declared spec-kit floor admits pre-release builds of the engine it targets

The version floor SHALL be expressed so that development builds of the engine release that introduced the required surface still satisfy it. Because PEP 440 sorts a dev build below its final, a bare floor at the exact required release rejects the builds the floor is meant to admit.

#### Scenario: a user runs a source-installed spec-kit
- **WHEN** the installed engine reports a dev-suffixed version of the release that first shipped the required surface
- **THEN** the extension installs rather than being rejected as too old

### Release artifacts of the two products never resolve to each other

Both products publish into one GitHub releases list, so isolation MUST be enforced by name rather than recency. The extension SHALL release under the `speckit-ext-v*` tag prefix, distinct from the VS Code extension's `v*` prefix, and its stable download SHALL resolve through the dedicated `companion-latest` prerelease tag. A bare `/releases/latest` lookup MUST NOT be used anywhere in this repo.

#### Scenario: the other product cuts a release
- **WHEN** a VS Code release is published after the most recent extension release
- **THEN** the documented install and update URL still serves the extension's archive
- **AND** no Marketplace publish is triggered by an extension tag

#### Scenario: the stable asset is refreshed
- **WHEN** a new extension version is released
- **THEN** the rolling stable asset is replaced in place and re-asserted as a prerelease, so it stays out of the "latest across both products" resolution

### The release archive is an allow-list gated against what the shipped commands actually call

The package SHALL contain only runtime files, derived from a single declared packing list rather than a deny-list of exclusions. A gate MUST independently derive what the shipped command bodies reach for, follow those scripts' own imports, and fail when the derived closure and the declared list disagree in either direction.

#### Scenario: a new command calls a new script
- **WHEN** a command body references a script that is not on the packing list
- **THEN** the gate fails before an archive can be built, naming the script

#### Scenario: a script becomes unreachable
- **WHEN** a packaged script is no longer referenced by any shipped command
- **THEN** the gate flags it as dead weight rather than shipping it silently

#### Scenario: docs restate the packing list
- **WHEN** publishing documentation describes what ships
- **THEN** it defers to the packing list as the source of truth instead of re-typing the file names

### Every pipeline step writes its progress to the spec's context file, whatever invoked it

The extension SHALL bind capture to the pipeline's lifecycle points so that progress lands in the spec's `.spec-context.json` on every path — hand-invoked commands, engine-driven runs, and resumed runs alike. Capture MUST degrade gracefully when its optional runtime dependency is absent and MUST NOT fail the host spec-kit command.

#### Scenario: the same step runs through different entry points
- **WHEN** a step is dispatched directly, by the workflow engine, or on resume
- **THEN** the same capture fires and the recorded progress is identical

#### Scenario: the optional interpreter is missing
- **WHEN** the host has no usable `python3`
- **THEN** the capture warns and skips, and the underlying spec-kit step still completes

### The pipeline also ships as a workflow definition runnable on spec-kit's own engine

A workflow definition SHALL express the full pipeline — draft, route, plan, tasks, implement, complete — so a user can run or resume the whole thing with one engine command instead of invoking each step. Its review gates MUST pause before consequential phases, and rejecting a gate MUST abort rather than continue.

#### Scenario: a run pauses and is picked up later
- **WHEN** a run stops at a review gate
- **THEN** resuming continues from the exact step it stopped at, with capture unchanged

#### Scenario: the workflow is used without installing
- **WHEN** the definition is invoked by local path
- **THEN** it runs without requiring registration first

### Right-sizing routes the pipeline and never silently drops a phase

The pipeline SHALL classify a change's size and route on that signal, with the thresholds authored in one place and consumed by both the routing step and the command bodies. The routing default MUST be the full pipeline, so an ambiguous or unresolved size can only add ceremony, never remove a phase.

#### Scenario: the size signal is missing or unrecognized
- **WHEN** classification yields a value the routing step has no case for
- **THEN** the full pipeline with its review gates runs

#### Scenario: a change is oversized
- **WHEN** the change exceeds the guardrail
- **THEN** a visible warning is emitted and the full pipeline still runs

#### Scenario: a change is small
- **WHEN** the change is under the guardrail
- **THEN** the review pauses are folded away while the artifacts each phase produces are still generated

### Completion is an explicit terminal step the extension owns

The pipeline SHALL end by writing a completed status for the spec, rather than stopping at "implemented" and leaving the run open. This terminal step is the extension's addition — the stock pipeline has no equivalent — and it MUST be driven by the command, not left to the assistant's discretion.

#### Scenario: implementation finishes
- **WHEN** the last implementation step of a Companion run completes
- **THEN** the terminal step runs and the spec's recorded status becomes completed
- **AND** the GUI reflects the run as finished without further user action

### Installing the extension never removes the stock spec-kit command set

The extension's commands SHALL live in their own namespace and coexist with the stock commands. Enabling or disabling the Companion path MUST NOT add, remove, or swap the carrier that keeps the stock commands present; recovery of the stock set MUST be add-only.

#### Scenario: a user toggles the Companion path
- **WHEN** the Companion workflow is enabled or disabled
- **THEN** both command families remain installed and invocable

#### Scenario: a prior version stranded the stock commands
- **WHEN** the extension is (re-)installed over such a project
- **THEN** the stock command set is restored without anything being deleted

### Its behavior is guarded by a dependency-free test suite and parity gates in CI

The extension SHALL be verifiable without installing dependencies, and CI MUST run its tests alongside gates that assert the shipped artifacts still agree with their sources — capture shape, command re-assembly, and release packaging.

#### Scenario: a command body is edited by hand instead of at its source
- **WHEN** a shipped command diverges from what its sources assemble to
- **THEN** the assembly parity gate fails in CI

#### Scenario: shared instructions are forked into a command
- **WHEN** a command pastes its own copy of the shared instructions instead of pulling the single shared one
- **THEN** the shape-parity gate fails, keeping the shared rules a one-place edit

## Uncovered

- `speckit-extension/scripts/**`, `speckit-extension/commands/**`, `speckit-extension/nodes/**`, `speckit-extension/presets/**` — deliberately out of scope here; covered by the two leaf specs, which take precedence.
- `speckit-extension/CHANGELOG.md`, `ROADMAP.md`, `LICENSE`, `assets/**`, `examples/ship-ticket/**` — not read (release history, roadmap, licensing, and illustrative example content carry no durable requirement for this parent).
- `speckit-extension/docs/*.md` and `README.md` — read at heading level plus the install and publishing sections; the remaining long-form prose was not read in full.
- `speckit-extension/tests/**` — read by file and test-class name only; individual assertions were not read.
