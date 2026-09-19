# Update from the new-version notification

**Issue**: #743

## User Scenarios & Testing

### User Story 1 - Update straight from the notification (Priority: P1)

When a newer SpecKit Companion is published, the notification a developer sees offers Update as its first button. Pressing it installs the newest version the editor's gallery serves, and once the install lands the developer is offered a reload so the new version takes over. They never have to open the Extensions view to find the extension.

**Why this priority**: this is the gap the issue reports. Today neither button in the notification updates anything.

**Independent Test**: show the notification for a newer version, press Update, and check that the install ran without pinning a version and a reload was offered.

**Acceptance Scenarios**:

1. **WHEN** a newer version is found, **THEN** the notification offers Update, View Changelog and Skip, in that order.
2. **WHEN** the developer presses Update and the install succeeds, **THEN** a reload is offered.
3. **WHEN** the developer accepts the reload, **THEN** the window reloads.

### User Story 2 - Update when the install fails (Priority: P1)

An install can fail: the editor is offline, or its gallery rejects the request. A developer who presses Update then lands on the extension's page instead of watching nothing happen.

**Why this priority**: without it, the new button can fail silently.

**Independent Test**: make the install fail, press Update, and check that the extension's page opens.

**Acceptance Scenarios**:

1. **WHEN** the install fails, **THEN** the extension's page opens in the editor.
2. **WHEN** the editor cannot open that page either, **THEN** the Marketplace page opens in the browser.

### User Story 3 - The other buttons keep working (Priority: P2)

View Changelog still opens that version's release notes, and Skip still stops that version from being offered again.

**Why this priority**: both exist today and must not regress.

**Independent Test**: press each button and check its existing effect.

**Acceptance Scenarios**:

1. **WHEN** the developer presses View Changelog, **THEN** that version's own release page opens.
2. **WHEN** the developer presses Skip, **THEN** that version is not offered again.

## Edge Cases

- The notification is dismissed without a button: nothing is installed, nothing is skipped.
- The developer declines the reload: the new version is installed and takes over on the next window reload.
- An editor that uses OpenVSX: the install resolves through that editor's own gallery, with no separate path.

## Requirements

### Functional Requirements

- **FR-001**: The new-version notification MUST offer Update, View Changelog and Skip, with Update first.
- **FR-002**: Update MUST install the newest version the editor's gallery serves without pinning a version, so automatic updates keep working.
- **FR-003**: After a successful install, the developer MUST be offered a window reload, and accepting it MUST reload the window.
- **FR-004**: When the install fails, the extension's page MUST open instead, and the Marketplace page in the browser when the editor cannot open it.
- **FR-005**: View Changelog and Skip MUST keep their current behavior.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A developer goes from the notification to the new version in 2 clicks: Update, then Reload.
- **SC-002**: Pressing Update never ends with no visible result: every press either offers a reload or opens the extension's page.
- **SC-003**: Each of the three buttons is covered by a test.

## Assumptions

- Installing a specific version pins the extension in VS Code and turns off its automatic updates, so Update installs the newest version instead. A release can reach GitHub a few minutes before the Marketplace; an Update pressed then brings nothing new, and the notification returns at the next daily check.
- The reload offer is a follow-up notification, not a modal dialog.

## Verbatim Constraints

- `Update`
- `View Changelog`
- `Skip`
- `workbench.extensions.installExtension`
- `alfredoperez.speckit-companion`
- `extension.open`

## Approach

- `src/speckit/updateChecker.ts`: `showUpdateNotification` offers `Update` first. Update runs `workbench.extensions.installExtension` with the extension's own id, unpinned; on success it offers `Reload Window` (`workbench.action.reloadWindow`); on failure it runs `extension.open`, falling back to the Marketplace URL.
- `src/speckit/updateChecker.test.ts`: the button order, a successful update plus reload, a failed update opening the page, and dismissal installing nothing. View Changelog and Skip tests stay.
- `docs/getting-started.md`, root `CHANGELOG.md`: the notification can update the extension.

## ADDED Requirements
<!-- capability: speckit-cli-notifications -->

### The new-version notification can install the version it offers

The new-version notification SHALL offer Update first, ahead of View Changelog and Skip. Update SHALL install the newest version the editor's gallery serves without pinning a version, then offer a window reload. When the install fails, Update SHALL open the extension's page instead of failing silently.

#### Scenario: the install succeeds
- **WHEN** the developer presses Update
- **THEN** the newest version is installed, automatic updates stay on, and a reload is offered

#### Scenario: the install fails
- **WHEN** the developer presses Update and the install fails
- **THEN** the extension's page opens
