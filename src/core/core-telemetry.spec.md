# Core Telemetry — Living Spec

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Core owns the one telemetry service every feature reports through, so the rule that nothing user-authored leaves the machine is enforced in one place.

## Requirements

### Telemetry carries shapes, never content
<!-- touches: src/core/telemetry.ts -->

Every telemetry payload SHALL contain only enum-like values, booleans, versions, counts, and a random per-spec identifier. User-authored text, such as prompt content, file paths, spec names, and custom workflow and step names, MUST never be sent. Any value from disk or settings that could be free text MUST be coerced to a known allow-list before reporting, with anything unrecognized reduced to a neutral placeholder.

#### Scenario: a user-defined workflow step runs
- **WHEN** an event reports which phase it belongs to
- **THEN** built-in phase names are sent verbatim and any other step name is reported as a generic marker

#### Scenario: an event reports which workflow was involved
- **WHEN** any event carries a workflow attribution
- **THEN** it goes through the single shared workflow coercer: built-in workflow ids verbatim, the legacy default alias as the stock id, and any custom workflow name as a generic marker
- **AND** no event carries the retired pipeline-profile property

#### Scenario: a spec has no correlation identifier yet
- **WHEN** an event fires for it
- **THEN** a random identifier is minted and persisted so later events for the same spec correlate
- **AND** a failure to persist it does not block the event

#### Scenario: the extension activates
- **WHEN** the activation event fires
- **THEN** it carries only versions, a spec count, a companion-installed boolean, and enum-like feature-flag states, never a spec name, path, or user-authored workflow name
- **AND** the default-workflow flag reports the user's raw configured value (unset reads as stock `speckit`), never the install-derived effective default, so the adoption metric counts only an explicit Companion choice

### Engagement is counted without naming what was engaged
<!-- touches: src/core/telemetry.ts -->

The extension SHALL emit a bare event when a spec, living spec, or steering document is opened, and when a living-spec drift or sync runs, carrying only the common facts attached to every event. The install-banner funnel SHALL be reported as fixed `shown`/`clicked` × surface literals from our own call sites. Install-prompt surfaces are a closed allow-list (create-spec, activity, sidebar badge, pinned row, welcome, terminal, activation), and update-nudge surfaces are separate members (create-spec, activity, status bar, activation) so an update nudge is never counted as an install one.

An untrusted surface value, such as a command argument from a `viewsWelcome` button, MUST be coerced to a known allow-list member before reporting, and an unrecognized value MUST be dropped. Opened-in-viewer events MUST be de-duplicated per session by an internal identity that is never sent. A de-dupe slot MUST be claimed only after the event actually emits, so an open while telemetry was off or uninitialized still fires once telemetry is available.

#### Scenario: the same spec is re-revealed in the viewer
- **WHEN** the panel re-renders and would re-emit the open event
- **THEN** only the first open of that spec this session is sent, keyed by an identity that never leaves the process

#### Scenario: a spec is opened while telemetry is disabled
- **WHEN** the event cannot be sent yet
- **THEN** no de-dupe slot is consumed, so the first successful send still happens once telemetry turns on

### The activation funnel is measured rung by rung, each with its own de-dupe scope
<!-- touches: src/core/telemetry.ts -->

The extension SHALL emit one event per activation-funnel rung (installed, panel opened, spec created, phase dispatched, completed), plus a sample-opened event for the welcome's live sample, each de-duplicated at its own scope. The installed event fires once per install identity, never per session, recorded in a persistent marker claimed only after a confirmed send; wiped persistent state counts as a new install identity. Panel-opened and sample-opened fire once per session, and completed fires exactly once per transition into the completed status, observed at the single seam every completion path goes through.

Every funnel event SHALL honor both telemetry switches, and no de-dupe slot, persistent or in-memory, is consumed when the event could not be sent.

#### Scenario: the extension activates again on the same install
- **WHEN** a later session activates and the persistent installed marker is already set
- **THEN** no installed event is sent

#### Scenario: the first activation happens with telemetry disabled
- **WHEN** the installed event cannot be sent
- **THEN** the persistent marker is not written, so the install is still reported once telemetry turns on

#### Scenario: the specs panel is toggled repeatedly in one session
- **WHEN** the panel becomes visible a second time
- **THEN** no second panel-opened event is sent

#### Scenario: a created spec is attributed
- **WHEN** the created event fires from the create form or from the watcher observing a terminal-created spec
- **THEN** it carries the effective workflow selection through the shared coercer, how the workflow was chosen for form submissions, and which source observed the creation, never a name or path

### Both telemetry switches gate every event and apply without restart
<!-- touches: src/core/telemetry.ts -->

The extension SHALL send an event only when both the editor-wide telemetry gate and its own telemetry setting are on. Turning either off MUST stop all events immediately, and turning it back on MUST resume sending, both without a reload. Changes are tracked through the editor's telemetry-changed notification, not a per-send poll.

#### Scenario: editor-wide telemetry is disabled mid-session
- **WHEN** the editor-wide telemetry setting turns off while the extension is running
- **THEN** no further events are sent, and re-enabling it resumes sending without reconstructing anything

### Every event carries the common facts under an anonymous install identity
<!-- touches: src/core/telemetry.ts -->

The extension SHALL attach the extension version, editor version, and platform to every event, and SHALL group events per install under the editor's anonymized machine identifier, processed anonymously with no person profile. On a key collision, event-specific properties win over the common facts.

#### Scenario: any event is inspected at the backend
- **WHEN** a received event is opened
- **THEN** it carries the extension version, editor version, and platform, grouped under an anonymous install identity never derived from the user

### Telemetry delivery is fire-and-forget and silently fallible
<!-- touches: src/core/telemetry.ts -->

Each event SHALL be delivered as a single post with no queue, retries, or batching. A delivery failure of any kind (offline, outage, quota, non-success response) MUST surface nothing to the user and block nothing.

#### Scenario: the analytics backend is unreachable
- **WHEN** events fire while the backend is down
- **THEN** the extension behaves normally and no error is surfaced or logged to the user

## Uncovered

_None. Every file in the area was read._
