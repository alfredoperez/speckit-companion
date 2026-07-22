# Feature Specification: Track install rate and prompt→install conversion for the spec-kit extension

**Feature Branch**: `523-install-prompt-telemetry`
**Created**: 2026-07-21
**Status**: Draft
**Input**: Issue #506 — the workflow picker and the "Install the spec-kit extension…" banner already ship, but nothing measures how many users have the companion spec-kit extension installed, nor whether the banner converts.

## User Scenarios & Testing

### User Story 1 - Know the install rate (Priority: P1)

As a maintainer deciding where to invest, I want each activation to report whether the companion spec-kit extension is present, so I can see what share of active installs already have it versus still need the prompt.

**Why this priority**: Install rate is the denominator for every downstream question ("does the prompt convert?", "do installed users use the pipeline?"). Without it, none of those are answerable. It is also the smallest change — one boolean on an event that already fires.

**Independent Test**: Activate the extension with the companion spec-kit extension present, then absent, and confirm the `extension.activated` event carries a boolean `companionInstalled` reflecting each state.

**Acceptance Scenarios**:

1. **Given** the companion spec-kit extension dir exists in the workspace, **When** the extension activates, **Then** `extension.activated` is emitted with `companionInstalled` = `"true"`.
2. **Given** the companion spec-kit extension is not installed, **When** the extension activates, **Then** `extension.activated` is emitted with `companionInstalled` = `"false"`.
3. **Given** telemetry is disabled, **When** the extension activates, **Then** no event is sent (unchanged dual-gate behavior).

### User Story 2 - Measure whether the install banner converts (Priority: P1)

As a maintainer, I want to know when the install banner is shown and when its Install button is clicked, so I can compute the prompt→install conversion rate.

**Why this priority**: This is the core question the issue asks. Both moments (shown, clicked) must be measurable to form a funnel.

**Independent Test**: Render the banner in the Create-Spec panel and the Activity panel and confirm a "shown" telemetry event fires once per surface per session; click Install on each and confirm a "clicked" telemetry event fires with the originating surface.

**Acceptance Scenarios**:

1. **Given** the install banner becomes visible in the Create-Spec panel, **When** it is shown, **Then** a `companion.installPrompt` event is emitted with `action` = `"shown"` and `surface` = `"createSpec"`.
2. **Given** the banner is visible in the Activity panel, **When** it is shown, **Then** a `companion.installPrompt` event is emitted with `action` = `"shown"` and `surface` = `"activity"`.
3. **Given** the banner is shown and the webview HTML re-renders several times in the same session, **When** it re-renders, **Then** the "shown" event is emitted only once per surface (deduped within the session).
4. **Given** the banner is visible, **When** the user clicks its Install button, **Then** a `companion.installPrompt` event is emitted with `action` = `"clicked"` and the originating `surface`, and the existing install command still runs.

### User Story 3 - Compute used-vs-installed from existing usage (Priority: P2)

As a maintainer, I want to correlate install state with actual pipeline usage, so I can see whether installed users go on to use the Companion pipeline.

**Why this priority**: This needs no new event — it is a query over the new install-rate signal plus the usage events that already ship. This story exists to confirm those events remain in place, not to add anything.

**Independent Test**: Confirm `spec.created`, `spec.completed`, `phase.dispatched`, and `workflow.selected` events still exist and are emitted, so used-vs-installed is joinable in the dashboard.

**Acceptance Scenarios**:

1. **Given** the existing usage events, **When** a maintainer queries the telemetry store, **Then** install state (from `extension.activated.companionInstalled`) can be joined against usage without a new event.

## Edge Cases

- No open workspace folder at activation: `companionInstalled` reports `false` (no root to probe) rather than failing activation.
- The banner is dismissed for good (global-state flag): it never renders, so no "shown" event fires — correct, there was no prompt.
- Telemetry disabled (`speckit.telemetry` off or VS Code global off): no new events are sent, same as every existing event.
- The Install command is also reachable from the sidebar affordance and an upgrade menu, not just the banner: the "clicked" conversion event fires only from the banner's Install button, so it measures prompt conversion specifically, not every install trigger.

## Requirements

### Functional Requirements

- **FR-001**: The `extension.activated` event MUST carry a boolean-valued `companionInstalled` dimension reflecting whether the companion spec-kit extension is installed in the active workspace.
- **FR-002**: A `companion.installPrompt` event MUST be emitted with `action` = `"shown"` when the install banner becomes visible, tagged with the `surface` it appeared in (`"createSpec"` or `"activity"`).
- **FR-003**: The "shown" event MUST be deduplicated within a session so a chatty webview re-render emits it at most once per surface per session.
- **FR-004**: A `companion.installPrompt` event MUST be emitted with `action` = `"clicked"` and the originating `surface` when the banner's Install button is clicked, without changing the existing install behavior.
- **FR-005**: Every new telemetry field MUST be a boolean, count, or fixed enum literal — no identifiers, no paths, no free text — matching the existing scrubbing/allow-list boundary in the telemetry module.
- **FR-006**: The new events MUST respect the existing telemetry gates (opt-in `speckit.telemetry` plus VS Code's global setting); when telemetry is off, nothing is sent.
- **FR-007**: The existing usage events (`spec.created`, `spec.completed`, `phase.dispatched`, `workflow.selected`) MUST remain emitted so used-vs-installed stays computable without a new event.
- **FR-008**: The user-facing telemetry documentation MUST list the new signals and include a note that they read in App Insights via the `AppEvents` table (not `customEvents`), with a sample query.

### Key Entities

- **extension.activated event**: the once-per-session activation event; gains a `companionInstalled` boolean dimension alongside its existing version/count/snapshot fields.
- **companion.installPrompt event**: a new event with two dimensions — `action` (`"shown"` | `"clicked"`) and `surface` (`"createSpec"` | `"activity"`).

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of `extension.activated` events carry a `companionInstalled` value of `"true"` or `"false"`.
- **SC-002**: Each shown banner produces exactly one "shown" event per surface per session, regardless of how many times the webview re-renders.
- **SC-003**: Each banner Install click produces exactly one "clicked" event carrying the surface it came from.
- **SC-004**: No new telemetry field carries any identifier, path, or free-text value — only booleans and fixed enum literals.
- **SC-005**: Prompt→install conversion (clicked / shown) and install rate (installed / activated) are both computable from the emitted events with no additional instrumentation.

## Assumptions

- The two banner surfaces are the Create-Spec panel (`surface = "createSpec"`) and the Activity/spec viewer panel (`surface = "activity"`); these are the only two places `shouldShowInstallPrompt` gates the banner today.
- The "clicked" event is scoped to the banner's Install button rather than the shared install command, so it measures prompt conversion rather than all install invocations.
- Session-scoped dedupe (a module-level guard reset per extension host session) is the intended granularity for "once per shown occurrence."

## Verbatim Constraints

- Event name: `companion.installPrompt`
- Activation dimension: `companionInstalled`
- Action dimension values: `shown`, `clicked`
- Surface dimension values: `createSpec`, `activity`
- App Insights table for queries: `AppEvents` (not `customEvents`)
