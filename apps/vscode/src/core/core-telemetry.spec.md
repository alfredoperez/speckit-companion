# Core Telemetry — Living Spec

## Purpose

The one telemetry service every feature reports through, so the rule that nothing user-authored leaves the machine is enforced in one place.

## Requirements

### Telemetry carries shapes, never content
<!-- touches: apps/vscode/src/core/telemetry.ts -->

A telemetry payload SHALL hold only enum-like values, booleans, versions, counts and random identifiers. User-authored text such as prompts, file paths, spec names, and custom workflow or step names MUST never be sent: any value that could be free text is coerced to a known list, and anything unrecognized becomes a generic marker or is dropped.

#### Scenario: a custom workflow step runs
- **WHEN** an event reports its workflow and phase
- **THEN** built-in workflow and phase names are sent as-is, and a custom workflow or step name is sent as a generic marker

#### Scenario: a command argument names an unknown surface
- **WHEN** a welcome-view button passes a surface value that is not on the known list
- **THEN** the value is dropped from the event

### Events are grouped under anonymous identities
<!-- touches: apps/vscode/src/core/telemetry.ts -->

Every event SHALL carry the extension version, editor version and platform, grouped under the editor's anonymized machine id with no person profile. Events about one spec SHALL share a random identifier minted on first use and stored with the spec, and a failure to store it never blocks the event.

#### Scenario: any event is inspected at the backend
- **WHEN** a received event is opened
- **THEN** it carries the three common facts under an install identity not derived from the user

#### Scenario: a spec has no identifier yet
- **WHEN** an event fires for it
- **THEN** a random identifier is minted and stored, and later events for that spec carry the same one

### Each counted-once event is counted at its own scope
<!-- touches: apps/vscode/src/core/telemetry.ts -->

The installed event SHALL fire once per install identity, remembered across sessions, and wiped extension storage counts as a new install. Panel-opened, sample-opened and each spec's opened-in-viewer event fire once per session. Completed fires once per transition into the completed status. The key a session de-duplicates on never leaves the process.

#### Scenario: the extension activates again on the same install
- **WHEN** a later session activates
- **THEN** no installed event is sent

#### Scenario: the same spec is revealed twice in one session
- **WHEN** the viewer re-renders it
- **THEN** only the first open is sent

### A de-duplicated event is only marked sent once it was sent
<!-- touches: apps/vscode/src/core/telemetry.ts -->

No de-dupe marker, persistent or per session, SHALL be recorded for an event that could not be sent, so it still fires once telemetry becomes available.

#### Scenario: the first activation happens with telemetry disabled
- **WHEN** telemetry is later turned on
- **THEN** the installed event is sent once

### Update nudges are never counted as install prompts
<!-- touches: apps/vscode/src/core/telemetry.ts -->

Install-prompt and update-nudge exposures and clicks SHALL be reported under separate surface names, so an update nudge never inflates the install funnel.

#### Scenario: the update banner is shown in the Create Spec panel
- **WHEN** its exposure is reported
- **THEN** it is counted under the update surface, not the install one

### The default-workflow flag reports only an explicit choice
<!-- touches: apps/vscode/src/core/telemetry.ts -->

The activation event SHALL report the user's configured default workflow, unset reading as stock `speckit`, never the default derived from what is installed, so adoption counts only people who chose Companion.

#### Scenario: Companion is installed but no default is set
- **WHEN** the activation event fires
- **THEN** the default workflow is reported as `speckit`

### Both telemetry switches gate every event and apply without restart
<!-- touches: apps/vscode/src/core/telemetry.ts -->

An event SHALL be sent only while both the editor-wide telemetry setting and the extension's own telemetry setting are on. Turning either off stops events at once, and turning it back on resumes them, without a reload.

#### Scenario: editor-wide telemetry is disabled mid-session
- **WHEN** the editor setting turns off while the extension runs
- **THEN** no further events are sent, and re-enabling it resumes sending

### Telemetry delivery is fire-and-forget and silently fallible
<!-- touches: apps/vscode/src/core/telemetry.ts -->

Each event SHALL be sent once with no queue or retry, and a failed send MUST show nothing to the user and block nothing.

#### Scenario: the analytics backend is unreachable
- **WHEN** events fire while the backend is down
- **THEN** the extension behaves normally and no error reaches the user

## Uncovered

_None. Every file in the area was read._
