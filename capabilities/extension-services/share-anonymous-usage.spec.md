# Share Anonymous Usage — Living Spec

## Purpose

The maintainer learns which providers, workflows and features are used, and where new users drop off, without learning anything about the user or their code. Without the privacy limits below the extension would leak spec names and paths; without the counting rules the funnel numbers would be wrong.

## Requirements

### Two switches gate every event
<!-- touches: apps/vscode/src/core/telemetry.ts, package.json -->

An event SHALL be sent only while `speckit.telemetry` is on and VS Code's own telemetry is enabled. Turning either off stops sending immediately, with no reload.

#### Scenario: the editor-wide switch is off
- **WHEN** VS Code telemetry is disabled and `speckit.telemetry` is `true`
- **THEN** nothing is sent

### Events never carry anything the user wrote
<!-- touches: apps/vscode/src/core/telemetry.ts -->

Event properties SHALL be limited to fixed enum-like values, booleans, versions, counts and a random per-spec id. Prompt text, file paths, spec names, capability names, custom workflow names and custom step names SHALL never be sent: a custom workflow or step is reported as the literal `custom`. Every event also carries the extension version, VS Code version and platform, grouped under VS Code's anonymous machine id.

#### Scenario: a user-defined workflow
- **WHEN** a spec is created with a custom workflow called `acme-internal`
- **THEN** the event reports the workflow as `custom`

### One spec's events share a random id
<!-- touches: apps/vscode/src/core/telemetry.ts, apps/vscode/src/features/fileWatchers.ts -->

Each spec SHALL get a random id, stored in its `.spec-context.json`, that rides its created, dispatched and completed events. A spec that has none yet gets one the first time an event needs it, written without disturbing anything else in the file.

#### Scenario: a spec from before telemetry existed
- **WHEN** a step is dispatched for a spec whose context has no id
- **THEN** an id is minted, used for this event, saved, and reused for every later event

### A once-only event is used up only when it was really sent
<!-- touches: apps/vscode/src/core/telemetry.ts, apps/vscode/src/extension.ts -->

Installed is reported once ever per install. Panel opened and sample opened are reported once per session, spec opened once per spec per session, living spec opened once per capability per session, and an install prompt shown once per surface per session. An event suppressed by a closed switch SHALL NOT use up its once-only slot. Drift runs, sync runs, steering opens and install prompt clicks count every time.

#### Scenario: telemetry is turned on later
- **WHEN** the first start-up happened with telemetry off and the user turns it on a week later
- **THEN** the installed event is sent at the next start-up

### The start-up snapshot reports settings as they are now
<!-- touches: apps/vscode/src/extension.ts, apps/vscode/src/core/telemetry.ts -->

Once per start-up the extension SHALL report its version, the spec count, whether the Companion extension is installed, and the state of the default workflow, Activity panel, install prompt and telemetry settings. The default workflow is reported as configured, not as the effective default, and old setting values are reported in their current form.

#### Scenario: companion installed, default workflow never set
- **WHEN** the Companion extension is installed and `speckit.defaultWorkflow` was never set
- **THEN** the snapshot reports `speckit`

### Creation and completion are counted from what lands on disk
<!-- touches: apps/vscode/src/features/fileWatchers.ts, apps/vscode/src/features/specs/transitionLogger.ts -->

A spec created outside the Create Spec form SHALL be counted as created when its context file first appears, marked as seen by the watcher. A spec SHALL be counted completed exactly once, when its status changes to completed while the window is open, whichever path completed it. Specs already completed at start-up, and the seeded sample spec, SHALL never count. A completion that happens while VS Code is closed goes uncounted.

#### Scenario: the pipeline's last step completes the spec from a terminal
- **WHEN** an AI run writes status `completed` into a spec's context file
- **THEN** one completed event is sent, even though more than one watcher sees the write

### Telemetry can never be felt
<!-- touches: apps/vscode/src/core/telemetry.ts -->

Each event SHALL be a single fire-and-forget request with no queue and no retry. A failed or unreachable backend SHALL never surface to the user or slow any action.

#### Scenario: offline
- **WHEN** the machine has no network and a spec is created
- **THEN** the spec is created normally and no error appears
