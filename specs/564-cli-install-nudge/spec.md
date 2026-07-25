# Feature Specification: CLI/Terminal Install Nudge for the Companion Extension

**Feature Branch**: `564-cli-install-nudge`
**Created**: 2026-07-25
**Status**: Specified
**Input**: Nudge users to install the companion spec-kit extension from the CLI/terminal path — the terminal counterpart to the in-editor install nudges (#543). Part of epic #520.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover the Companion extension from the terminal flow (Priority: P1)

A developer who runs the spec-driven pipeline through a terminal-based AI CLI (Claude Code, Codex, Copilot CLI, Gemini, and the like) has spec-kit set up but has never installed the companion spec-kit extension. When they dispatch a standard spec-kit command from the extension, they see a single, quiet, dismissable hint that installing the companion extension unlocks the richer Companion pipeline. The run itself is never blocked or delayed.

**Why this priority**: This is the whole feature — the terminal audience is the exact set of users who never see the in-editor discovery surfaces from #543, so they are the ones the install funnel is missing. Without this, a large slice of users never learn the companion extension exists.

**Independent Test**: With spec-kit detected, the companion extension absent, and the nudge not previously dismissed, dispatch a stock `/speckit.*` command through a terminal-CLI provider and confirm exactly one non-blocking hint appears offering to install, and that the dispatched command still runs.

**Acceptance Scenarios**:

1. **Given** spec-kit is detected, the companion extension is not installed, and the nudge has never been dismissed, **When** the extension dispatches a stock `/speckit.*` command to a terminal-CLI provider, **Then** a single non-blocking install hint is shown and the command still dispatches.
2. **Given** the same state, **When** the user dispatches several stock commands in the same session, **Then** the hint appears at most once for that session (never once per command).
3. **Given** the install hint is showing, **When** the user chooses to install, **Then** the existing one-click companion install flow runs and the choice is recorded as a conversion for the terminal surface.

### User Story 2 - Never be nagged twice (Priority: P1)

A developer who has already dismissed the install nudge — whether from an in-editor surface (#543) or from the terminal hint — is never shown it again, on any surface, until they act on it. The dismissal is a single shared decision, not a per-surface one.

**Why this priority**: A discovery hint that re-nags is worse than no hint. Respecting one shared dismissal across both the editor and terminal surfaces is what keeps the feature "quiet" and trustworthy, and it is an explicit constraint of the parent epic.

**Independent Test**: Dismiss the nudge from any surface, then dispatch a stock command through a terminal-CLI provider and confirm no hint appears.

**Acceptance Scenarios**:

1. **Given** the user previously dismissed the in-editor install nudge, **When** they dispatch a stock `/speckit.*` command to a terminal-CLI provider, **Then** no terminal hint is shown.
2. **Given** the terminal hint is showing, **When** the user chooses "don't show again", **Then** the shared dismissal is remembered across sessions and no further nudge (terminal or in-editor) appears.

### User Story 3 - Stay quiet when the nudge is not warranted (Priority: P2)

The hint only appears for the audience that needs it. A developer who already has the companion extension installed, or who works in a project without spec-kit, or who uses an in-editor chat provider (which already has the #543 surfaces), never sees the terminal hint.

**Why this priority**: Correct gating is what makes the feature acceptable to ship. Over-nudging installed users or non-spec-kit projects would be an immediate annoyance and a support complaint.

**Independent Test**: For each of (companion installed) / (no spec-kit detected) / (editor-chat provider), dispatch a command and confirm no terminal hint appears.

**Acceptance Scenarios**:

1. **Given** the companion extension is installed, **When** a stock command is dispatched, **Then** no terminal hint is shown.
2. **Given** spec-kit is not detected in the workspace, **When** a command is dispatched, **Then** no terminal hint is shown.
3. **Given** the configured provider is an in-editor chat/panel provider (not a terminal CLI), **When** a command is dispatched, **Then** no terminal hint is shown (those users already have the in-editor nudges).

## Edge Cases

- No workspace folder open: the gate cannot resolve a root — skip silently, never throw.
- Telemetry disabled: the hint still renders (it is a user affordance, not a telemetry event); only the "shown" signal is suppressed, and it must be gated on the exact same render condition so the funnel is not over-counted.
- The nudge must never block, delay, or fail the dispatched command — a failure in the nudge path is swallowed and the command proceeds.
- A companion-namespaced command that already downgrades to stock and shows the existing fallback warning must not additionally fire the terminal hint (no double notification in one dispatch).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST show a single, non-blocking, dismissable hint to install the companion spec-kit extension when it dispatches a stock `/speckit.*` command to a terminal-CLI provider.
- **FR-002**: The hint MUST be gated identically to the in-editor nudges — shown only when spec-kit is detected AND the companion extension is not installed AND the shared dismissal has not been set.
- **FR-003**: The hint MUST NOT appear for in-editor chat/panel providers, which already surface the #543 in-editor nudges.
- **FR-004**: The hint MUST reuse the existing install infrastructure — the one-click install command, the `installNudgeDismissed` shared dismissal state, and the `isCompanionInstalled(root)` detector — and MUST NOT introduce a parallel nudge system.
- **FR-005**: The shared dismissal MUST be honored in both directions: dismissing from an in-editor surface suppresses the terminal hint, and dismissing from the terminal hint suppresses the in-editor surfaces.
- **FR-006**: The hint MUST appear at most once per session for a given user, in addition to being permanently suppressed once dismissed.
- **FR-007**: The hint MUST never block, delay, or fail the dispatched command; any error in the nudge path is swallowed and the command proceeds.
- **FR-008**: When a "shown" telemetry signal is recorded, it MUST be gated on the exact same condition the hint actually renders on, and carry a per-surface label of `terminal`, consistent with the existing install-prompt telemetry. No new personal data is recorded — only booleans/fixed labels, gated on the telemetry setting.
- **FR-009**: When the user acts on the hint to install, the existing one-click companion install flow MUST run and the action MUST be recorded as a conversion for the `terminal` surface.

## Key Entities

- **Install nudge state**: the single shared, persisted dismissal flag (`installNudgeDismissed`) plus a per-session "already shown" guard. Not a new store — the existing dismissal state extended with a session guard.
- **Install prompt surface**: the label set describing where the install prompt appeared, extended with a `terminal` value for funnel attribution.
- **Provider dispatch target**: whether the configured AI provider dispatches to a terminal CLI or to an in-editor chat/panel, used to decide whether the terminal hint applies.

## Success Criteria *(mandatory)*

- **SC-001**: A terminal-CLI user with spec-kit detected, the companion extension absent, and no prior dismissal sees the install hint exactly once per session, and the dispatched command still runs every time.
- **SC-002**: After dismissing from any surface, the user sees zero further install nudges (terminal or in-editor) across sessions.
- **SC-003**: Users who have the companion extension installed, work without spec-kit, or use an in-editor chat provider see zero terminal hints.
- **SC-004**: The "shown" telemetry count for the `terminal` surface never exceeds the number of times the hint actually rendered (no over-counting from a looser gate).
- **SC-005**: No dispatched command is ever blocked, delayed, or failed by the nudge in any of the above scenarios.

## Assumptions

- "Terminal-CLI provider" means any configured provider that dispatches spec-kit commands to a VS Code terminal (Claude Code, Codex, Copilot CLI, Gemini, Qwen, OpenCode, Wibey, Antigravity), as opposed to the in-editor chat/panel providers (IDE Chat, Claude panel, Wibey panel), which are covered by #543.
- "Once per session" is scoped to the extension host session; a reload may show it again unless the user has dismissed it, which matches the intent of a quiet, occasional reminder.
- The existing fallback warning (a companion-namespaced command downgrading to stock) remains the surface for that specific case; the new hint covers the stock-workflow terminal dispatch that currently has no nudge at all.

## Verbatim Constraints

- Shared dismissal state key: `installNudgeDismissed`
- Detector: `isCompanionInstalled(root)`
- Reused commands: `speckit.companion.installNudge`, `speckit.companion.dismissInstallNudge`
- Telemetry surface label: `terminal`
