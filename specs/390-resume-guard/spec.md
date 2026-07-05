# Feature Specification: Guard the sidebar Resume action when the spec-kit extension is missing

**Feature**: 390-resume-guard
**Source**: [#407](https://github.com/alfredoperez/speckit-companion/issues/407)

## Overview

The sidebar's Resume button continues a spec's pipeline by sending the companion resume command to the AI CLI. Today that dispatch is unguarded: with the resume feature on but the companion spec-kit extension not installed, the button still shows, and clicking it sends a command the CLI cannot resolve — nothing happens and the user gets no explanation. Every other lifecycle dispatch already routes through a fallback that warns and offers the extension install; Resume is the one gap. This change hides the button when the extension is absent and, as a second layer, makes the handler suppress the dispatch with the same install-extension warning used elsewhere.

## User Scenarios & Testing

### User Story 1 - Resume never dispatches into the void (Priority: P1)

A user without the companion spec-kit extension enables the resume feature. The Resume button no longer appears on spec rows; if the command is somehow invoked anyway, instead of a silent no-op they see the standard warning explaining the companion extension is needed, with an install action.

**Why this priority**: It's the last unguarded dispatch — a visible button that does nothing erodes trust in the whole sidebar.

**Independent Test**: In a workspace without `.specify/extensions/companion/`, enable the resume setting and confirm the button is absent; invoke the command programmatically and confirm the warning + no terminal dispatch.

**Acceptance Scenarios**:
1. **Given** the resume feature is enabled and the companion extension is not installed, **When** the sidebar renders a resumable spec row, **Then** no Resume button appears.
2. **Given** the same state, **When** the resume command is invoked directly, **Then** no command is sent to the AI CLI and the install-extension warning shows.
3. **Given** the companion extension is installed, **When** Resume is clicked, **Then** the companion resume command dispatches exactly as before.
4. **Given** the extension is installed mid-session, **When** the detection watcher fires, **Then** the button appears without a reload (existing context-key behavior).

## Edge Cases

- Extension removed mid-session → the context-key watcher flips and the button hides on the next menu evaluation; a stale click still hits the handler guard.
- Resume has no stock twin → the guard must suppress (dispatch nothing), never downgrade to an unrelated stock command.
- The warning must be non-blocking and match the existing missing-extension message + "Install spec-kit Extension" action.

## Requirements

### Functional Requirements

- **FR-001**: The sidebar Resume button MUST be visible only when both the resume feature is enabled and the companion spec-kit extension is installed.
- **FR-002**: The resume command handler MUST route through the shared dispatch fallback; when the extension is missing it MUST suppress the dispatch entirely (resume has no stock twin) and show the standard install-extension warning.
- **FR-003**: With the extension installed, resume behavior MUST be unchanged (same command text, terminal, and telemetry/log lines).
- **FR-004**: The suppression path MUST be covered by a unit test alongside the existing dispatch-guard tests.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In a no-extension workspace, zero unresolvable commands are dispatched from the Resume path (handler test proves suppression).
- **SC-002**: The button-visibility gate is expressed in the contribution's when-clause (inspectable) and the existing detection watcher drives it live.
- **SC-003**: All jest suites and both tsc configs pass.

## Assumptions

- The existing `speckit.companion.installed` context key (set on activation + file watcher) is the authoritative visibility signal; no new detection is added.
- The command-palette entry stays hidden (`when: false`) as today.

## Verbatim Constraints

- Menu gate adds `speckit.companion.installed` to the existing `speckit.resumeBeta` condition for `speckit.specs.resume`.
- Handler routes through `resolveDispatchWithFallback` with the command `speckit.companion.resume`.

## Approach

- `package.json` `contributes.menus."view/item/context"`: append `&& speckit.companion.installed` to the `speckit.specs.resume` when-clause.
- `src/features/specs/specCommands.ts` (resume handler ~line 275): resolve `speckit.companion.resume` via `resolveDispatchWithFallback(…, relativePath)`; on `fellBack` log + show the existing warning (reuse the same message/action as `executeWorkflowStep`) and return; otherwise dispatch unchanged.
- `src/features/specs/profileDispatch.test.ts`: add a case asserting `speckit.companion.resume` suppresses (command `null`, `fellBack: true`) without the extension.
- `docs/sidebar.md`: note the Resume button also requires the companion extension; `CHANGELOG.md`: user-facing fix entry.
