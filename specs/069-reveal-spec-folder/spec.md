# Feature Specification: Reveal Spec Folder in OS File Browser

**Feature Branch**: `069-reveal-spec-folder`
**Created**: 2026-04-20
**Status**: Draft
**Input**: User description: "Reveal spec folder in Finder/Explorer — right-click a spec → open its folder in the OS file browser."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reveal Spec Folder via Context Menu (Priority: P1)

A developer working in the SpecKit Companion specs tree view wants to inspect, copy, or share the raw files for a spec (spec.md, plan.md, tasks.md, `.spec-context.json`, checklists, etc.). They right-click the spec in the tree, choose "Reveal in Finder" (macOS) / "Reveal in File Explorer" (Windows) / "Open Containing Folder" (Linux), and the OS file browser opens at that spec's folder.

**Why this priority**: This is the entire feature. Without it, users must manually navigate `.claude/specs/<feature>/` every time they need to access files outside the extension's UI — a common friction point when debugging, sharing, or comparing specs.

**Independent Test**: Can be fully tested by right-clicking any spec in the tree and verifying the OS file browser opens at that spec's directory with the spec files visible.

**Acceptance Scenarios**:

1. **Given** a spec exists in the tree view, **When** the user right-clicks the spec and chooses the reveal action, **Then** the OS file browser opens showing that spec's folder contents.
2. **Given** the user is on macOS, **When** they trigger the reveal action, **Then** Finder opens with the spec's folder focused.
3. **Given** the user is on Windows, **When** they trigger the reveal action, **Then** File Explorer opens with the spec's folder focused.
4. **Given** the user is on Linux, **When** they trigger the reveal action, **Then** the default file manager opens at the spec's folder.

---

### Edge Cases

- **Folder was deleted externally**: If the spec's directory no longer exists on disk when the action fires, the extension surfaces a clear error message instead of silently failing.
- **Permission denied**: If the OS denies access to the folder, the underlying error is shown to the user.
- **Non-spec tree items**: The reveal action only appears on spec nodes, not on steering documents, workflow items, or group/section headers.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The specs tree view MUST expose a right-click context-menu action that reveals a spec's folder in the OS file browser.
- **FR-002**: The action MUST open the spec's root folder (the directory containing `spec.md`, `plan.md`, `tasks.md`, and `.spec-context.json`).
- **FR-003**: The action MUST use the platform-appropriate reveal behavior so the folder is shown in Finder on macOS, File Explorer on Windows, and the default file manager on Linux.
- **FR-004**: The action MUST only appear on spec tree items; it MUST NOT appear on steering docs, workflow entries, groupings, or other non-spec nodes.
- **FR-005**: If the spec folder cannot be opened (missing, permission error, etc.), the extension MUST display a user-visible error message describing the failure.

### Key Entities

- **Spec Tree Item**: Represents one spec in the tree view; exposes the absolute path of the spec's folder so the reveal action can act on it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open a spec's folder in the OS file browser in a single right-click interaction (two clicks total: right-click + menu item).
- **SC-002**: The reveal action works correctly on all three supported platforms (macOS, Windows, Linux) without platform-specific branching beyond the standard platform-aware reveal primitive.
- **SC-003**: 100% of spec tree items show the reveal action in their context menu; 0% of non-spec tree items show it.
- **SC-004**: When the target folder is missing, users see a clear error message within 1 second of triggering the action (no silent failures).

## Assumptions

- The extension already tracks each spec's absolute folder path via its existing tree data provider — no new filesystem scanning is required to implement this.
- VS Code's built-in reveal-in-OS command is acceptable as the reveal mechanism, so cross-platform behavior is delegated to the editor/host.
- The feature applies only to the specs tree; a parallel action for steering documents is out of scope for this spec.
