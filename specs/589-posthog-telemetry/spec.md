# Feature Specification: Restore Telemetry on PostHog

**Feature Branch**: `589-posthog-telemetry`
**Created**: 2026-08-25
**Status**: Draft
**Input**: GitHub issue #589 — the Azure subscription behind the extension's telemetry lapsed and took the analytics resource with it; every event since is silently rejected. Migrate anonymous usage telemetry to PostHog and restore the guarantees the extension already promises.

## User Scenarios & Testing

### User Story 1 - Usage data flows again (Priority: P1)

The maintainer installs a fresh build of the extension, uses it normally, and the anonymous usage events it emits arrive at the new analytics backend and appear in its dashboard. Today every event is rejected at the ingestion endpoint and discarded, so the project is flying blind on adoption and feature usage.

**Why this priority**: This is the whole point of the feature — without delivery to a working backend, nothing else here matters.

**Independent Test**: Install a build carrying the new credential in a clean environment, trigger a few events (activate the extension, open a spec), and confirm each appears in the analytics dashboard shortly after.

**Acceptance Scenarios**:

1. **Given** a fresh install with telemetry enabled, **When** the extension activates, **Then** the activation event is visible in the analytics dashboard within minutes.
2. **Given** a working session, **When** a user opens a spec in the viewer, **Then** the corresponding engagement event arrives at the backend and is countable in the dashboard.
3. **Given** the analytics backend is unreachable, **When** events are emitted, **Then** the extension behaves normally and surfaces no error to the user.

### User Story 2 - Both telemetry switches keep their promise (Priority: P1)

A privacy-conscious user turns telemetry off — either with the extension's own telemetry setting, or with the editor-wide telemetry setting that the extension's setting description promises to respect. In both cases, the extension stops sending events entirely. The editor-wide guarantee was previously provided by the retired telemetry library, so the migration must re-establish it rather than silently drop it.

**Why this priority**: This is an existing published privacy promise; shipping the migration without it would turn documented behavior into a lie.

**Independent Test**: Toggle each switch in turn and observe that no events leave the extension while either is off, and that events resume when both are on again — without restarting the editor.

**Acceptance Scenarios**:

1. **Given** the extension's telemetry setting is off, **When** any event-producing action happens, **Then** no event is sent.
2. **Given** the extension's telemetry setting is on but editor-wide telemetry is disabled, **When** any event-producing action happens, **Then** no event is sent.
3. **Given** telemetry was disabled editor-wide, **When** the user re-enables it mid-session, **Then** subsequent events send without requiring a reload.

### User Story 3 - Results break down the way they did before (Priority: P2)

The maintainer analyzes usage in the dashboard and slices every metric by extension version, editor version, and platform — the same breakdowns the old backend attached to every event automatically.

**Why this priority**: Delivery without these dimensions produces totals nobody can interpret; but events do arrive without it, so it ranks below the delivery and privacy stories.

**Independent Test**: Inspect any received event in the dashboard and confirm the three breakdown facts are present and correctly valued.

**Acceptance Scenarios**:

1. **Given** any event received by the backend, **When** it is inspected, **Then** it carries the extension version, the editor version, and the platform.
2. **Given** events from two different installs, **When** they are grouped in the dashboard, **Then** they group under distinct anonymous install identities without exposing who either user is.

### User Story 4 - The install-prompt funnel reads as a conversion rate (Priority: P2)

The maintainer opens the dashboard and reads the install-prompt funnel — how many times the prompt was shown versus clicked — as a conversion rate, per surface, without exporting data or hand-writing a query. On the old backend this required a hand-written query join.

**Why this priority**: This funnel is the primary metric the telemetry was rebuilt to answer, and the chosen backend was picked partly because it can express it natively.

**Independent Test**: Trigger a prompt-shown and a prompt-clicked event, then read the resulting conversion rate in the dashboard's funnel view.

**Acceptance Scenarios**:

1. **Given** shown and clicked events have been received, **When** the maintainer views the funnel, **Then** a conversion rate from shown to clicked is displayed per surface.

### User Story 5 - Documentation points at the living backend (Priority: P3)

A contributor reads the telemetry documentation to answer a usage question and finds working instructions for querying the new backend. Nothing in the shipped docs still directs them to the retired one, whose instructions were already stale even before it died.

**Why this priority**: Wrong docs waste contributor time, but they don't affect users or data collection.

**Independent Test**: Follow the documented query instructions end-to-end against the new backend and confirm they work; search the shipped docs for references to the retired backend and find none.

**Acceptance Scenarios**:

1. **Given** the updated documentation, **When** a reader follows its query instructions, **Then** they reach the extension's usage data in the new backend.
2. **Given** the shipped documentation, **When** it is searched for the retired backend's query surface, **Then** no references remain.

## Edge Cases

- Editor-wide telemetry is toggled off and back on mid-session: the change must take effect immediately in both directions, with no reload.
- The analytics backend is unreachable (offline, DNS failure, outage): the extension must work normally, surface no errors, and not accumulate unbounded retries.
- An event fires before telemetry has finished initializing: it is silently dropped, exactly as today — never a crash.
- Installs running older versions keep posting to the dead endpoint until they upgrade: accepted consequence, no remediation possible from our side.
- The backend's free-tier quota is exhausted and events are rejected: users must be entirely unaffected.
- A user disables the extension's switch after events were queued but not yet delivered: no further events are sent once the switch is off.

## Requirements

### Functional Requirements

- **FR-001**: Anonymous usage events MUST be delivered to the new analytics backend and be visible in its dashboard.
- **FR-002**: Turning the extension's own telemetry setting off MUST stop all events.
- **FR-003**: Disabling telemetry editor-wide MUST stop all events even when the extension's own setting is on, and runtime changes to either switch MUST take effect without a restart.
- **FR-004**: Every event MUST carry the extension version, the editor version, the platform, and the editor's anonymous per-install identifier — the same common facts the retired pipeline attached automatically.
- **FR-005**: Payloads MUST keep the existing privacy contract unchanged: enum-like values, booleans, versions, counts, and the random per-spec identifier only — never user-authored text, file paths, spec or workflow names, or any personal information.
- **FR-006**: All existing event names and property shapes MUST be preserved unchanged, so metrics stay comparable across the migration and event-producing call sites are untouched.
- **FR-007**: The install-prompt funnel MUST be readable in the new backend as a conversion rate from prompt shown to prompt clicked, per surface.
- **FR-008**: The retired backend's client library and its credential MUST be removed from the shipped extension.
- **FR-009**: The new ingestion credential MUST be write-only — able to push events but never read them — so it remains safe to publish with the extension.
- **FR-010**: The telemetry documentation MUST describe how to query the new backend and MUST NOT reference the retired one.
- **FR-011**: Telemetry failures MUST remain invisible and harmless to users: no error surfaces and no feature is blocked, regardless of backend availability.

### Key Entities

- **Usage Event**: One named occurrence (activation, spec opened, install prompt shown/clicked, …) with enum-like properties; the catalogue of names and shapes is fixed and carries over unchanged.
- **Common Properties**: The facts attached to every event — extension version, editor version, platform, anonymous install identity.
- **Install-Prompt Funnel**: The two-step shown → clicked sequence, dimensioned by the closed list of surfaces the prompt appears on.
- **Ingestion Credential**: The write-only key shipped inside the extension that authorizes event delivery and nothing else.

## Success Criteria

### Measurable Outcomes

- **SC-001**: An event emitted from a fresh install is visible in the analytics dashboard within 5 minutes.
- **SC-002**: With the extension's telemetry switch off, zero events leave the extension across a full session of normal use.
- **SC-003**: With editor-wide telemetry off and the extension's switch on, zero events leave the extension.
- **SC-004**: 100% of received events carry the extension version, editor version, and platform.
- **SC-005**: The install-prompt shown → clicked conversion rate is readable directly in the dashboard, without exporting data or writing a custom query.
- **SC-006**: The shipped documentation contains zero references to the retired backend.
- **SC-007**: A review of every event payload sent by the new pipeline finds no personal or user-authored data — the pre-existing privacy contract holds unchanged.

## Assumptions

- PostHog is the chosen backend, per the issue's diagnosis (no payment method to lapse, native funnels, free tier above current volume); current free-tier terms are re-verified during planning before committing.
- The editor's built-in anonymized machine identifier serves as the per-install identity; it is random and non-personal, and the retired pipeline already attached it, so this adds no new data collection.
- The historical data in the retired backend is gone and no import or recovery is attempted.
- Telemetry resumes only for installs that upgrade to the release carrying the new credential; older installs keep failing silently, which is accepted.
- The event catalogue is frozen for this change: no new events, no renames, no property additions beyond restoring the common facts the old pipeline attached.

## Verbatim Constraints

- The install-prompt funnel event is `companion.installPrompt` with actions `shown` and `clicked` — these exact names must keep working unchanged.
- The editor-wide telemetry gate is re-implemented with `vscode.env.isTelemetryEnabled` and `vscode.env.onDidChangeTelemetryEnabled`.
- The `@vscode/extension-telemetry` dependency is dropped.
- The swap is confined to `TelemetryService` in `src/core/telemetry.ts` — all event-producing call sites go through `sendTelemetryEvent(name, properties)` and must not change.

## ADDED Requirements
<!-- capability: core -->

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

## MODIFIED Requirements
<!-- capability: core -->

### Engagement is counted without naming what was engaged

The extension SHALL emit a bare event when a spec, a living spec, or a steering document is opened, and when a living-spec drift or sync runs — carrying nothing event-specific (only the common facts the sending service attaches to every event), so a count can never be tied to a name or path. The install-banner funnel is likewise reported as fixed `shown`/`clicked` × surface literals produced only by our own call sites. The set of install-prompt surfaces is a closed allow-list (create-spec, activity, sidebar badge, pinned row, welcome, terminal); a surface value that arrives untrusted — such as a command argument wired from a `viewsWelcome` button — MUST be coerced to a known member of that allow-list before it is reported, and an unrecognized value dropped rather than sent. Opened-in-viewer events MUST be de-duplicated per session so a re-rendering panel cannot inflate the count, and the de-dupe key used for that MUST be an internal identity that is never sent. A de-dupe slot MUST be claimed only after an event actually emits, so an open that happened while telemetry was off or uninitialized still fires once telemetry becomes available.

#### Scenario: the same spec is re-revealed in the viewer
- **WHEN** the panel re-renders and would re-emit the open event
- **THEN** only the first open of that spec this session is sent, keyed by an identity that never leaves the process

#### Scenario: a spec is opened while telemetry is disabled
- **WHEN** the event cannot be sent yet
- **THEN** no de-dupe slot is consumed, so the first successful send still happens once telemetry turns on
