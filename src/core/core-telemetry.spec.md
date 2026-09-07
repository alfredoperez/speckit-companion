# Core Telemetry — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

What the extension reports about itself and how: only shapes, never content; the engagement and activation-funnel counts with their de-dupe scopes; the two switches that gate every event; and fire-and-forget delivery.

## Requirements

### Telemetry carries shapes, never content

Every telemetry payload SHALL contain only enum-like values, booleans, versions, counts, and a random per-spec identifier. User-authored text — prompt content, file paths, spec names, custom workflow and step names — MUST never be sent. Any value read from disk or settings that could be free text MUST be coerced to a known allow-list before reporting, with anything unrecognized reduced to a neutral placeholder.

#### Scenario: a user-defined workflow step runs
- **WHEN** an event reports which phase it belongs to
- **THEN** built-in phase names are sent verbatim and any other step name is reported as a generic marker

#### Scenario: an event reports which workflow was involved
- **WHEN** any event carries a workflow attribution
- **THEN** it is coerced through the single shared workflow coercer — built-in workflow ids verbatim, the legacy default alias as the stock id, and any custom workflow name reduced to a generic marker
- **AND** the retired pipeline-profile dimension is attached to nothing; no event carries a profile property

#### Scenario: a spec has no correlation identifier yet
- **WHEN** an event fires for it
- **THEN** a random identifier is minted and persisted so later events for the same spec correlate
- **AND** a failure to persist it does not block the event

#### Scenario: the extension activates
- **WHEN** the activation event fires
- **THEN** it carries only versions, a spec count, a companion-installed boolean, and enum-like feature-flag states — never a spec name, path, or user-authored workflow name
- **AND** the default-workflow flag reports the user's raw configured value (an unset default reads as stock `speckit`), never the install-derived effective default, so the adoption metric counts only an explicit Companion choice

### Engagement is counted without naming what was engaged
<!-- touches: src/core/telemetry.ts -->

The extension SHALL emit a bare event when a spec, a living spec, or a steering document is opened, and when a living-spec drift or sync runs — carrying nothing event-specific (only the common facts the sending service attaches to every event), so a count can never be tied to a name or path. The install-banner funnel is likewise reported as fixed `shown`/`clicked` × surface literals produced only by our own call sites. The set of install-prompt surfaces is a closed allow-list (create-spec, activity, sidebar badge, pinned row, welcome, terminal, activation), and a surface that nudges an out-of-date install rather than a missing one is its own member of that list (create-spec, activity, status bar, activation) so an update nudge can never be counted as an install one; a surface value that arrives untrusted — such as a command argument wired from a `viewsWelcome` button — MUST be coerced to a known member of that allow-list before it is reported, and an unrecognized value dropped rather than sent. Opened-in-viewer events MUST be de-duplicated per session so a re-rendering panel cannot inflate the count, and the de-dupe key used for that MUST be an internal identity that is never sent. A de-dupe slot MUST be claimed only after an event actually emits, so an open that happened while telemetry was off or uninitialized still fires once telemetry becomes available.

#### Scenario: the same spec is re-revealed in the viewer
- **WHEN** the panel re-renders and would re-emit the open event
- **THEN** only the first open of that spec this session is sent, keyed by an identity that never leaves the process

#### Scenario: a spec is opened while telemetry is disabled
- **WHEN** the event cannot be sent yet
- **THEN** no de-dupe slot is consumed, so the first successful send still happens once telemetry turns on

### The activation funnel is measured rung by rung, each with its own de-dupe scope

The extension SHALL emit one event per activation-funnel rung — installed, panel opened, spec created, phase dispatched, completed — plus a sample-opened engagement event for the welcome's live sample, each de-duplicated at the scope that makes its count honest. The installed event fires once ever per install identity, recorded in a persistent marker that is claimed only after a confirmed send; a wiped persistent state legitimately reads as a new install identity, and the event never fires per session. The panel-opened and sample-opened events fire once per session, so repeated visibility toggles or repeated sample clicks cannot inflate them. The completed event fires exactly once per transition into the completed status, observed at a single seam every completion path flows through. Every funnel event honors both telemetry switches, and no de-dupe slot — persistent or in-memory — is consumed when the event could not be sent.

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
- **THEN** it carries the effective workflow selection coerced through the shared coercer, how the workflow was chosen for form submissions, and which source observed the creation — never a name or path

### Both telemetry switches gate every event and apply without restart

The extension SHALL send an event only when the editor-wide telemetry gate and its own telemetry setting are both on. Either switch turning off MUST stop all events immediately, and turning it back on mid-session MUST resume sending — in both directions without a reload, tracked through the editor's own telemetry-changed notification rather than a per-send poll.

#### Scenario: editor-wide telemetry is disabled mid-session
- **WHEN** the editor-wide telemetry setting turns off while the extension is running
- **THEN** no further events are sent, and re-enabling it resumes sending without reconstructing anything

### Every event carries the common facts under an anonymous install identity

The extension SHALL attach the extension version, editor version, and platform to every event it sends, and SHALL group events per install under the editor's own anonymized machine identifier processed anonymously (no person profile). Event-specific properties win over the attached common facts on a key collision, so call-site payloads stay frozen.

#### Scenario: any event is inspected at the backend
- **WHEN** a received event is opened
- **THEN** it carries the extension version, editor version, and platform, grouped under an anonymous install identity that is never derived from the user

### Telemetry delivery is fire-and-forget and silently fallible

Each event SHALL be delivered as a single post with no queue, no retries, and no batching; a delivery failure of any kind (offline, outage, quota, non-success response) MUST surface nothing to the user and block nothing.

#### Scenario: the analytics backend is unreachable
- **WHEN** events fire while the backend is down
- **THEN** the extension behaves normally and no error is surfaced or logged to the user
