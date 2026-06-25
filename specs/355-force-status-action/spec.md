# Feature Specification: Force-status recovery action in the sidebar

**Feature**: Set status… action on the SpecKit Companion sidebar tree
**Issue**: #347

## User Scenarios & Testing

### User Story 1 - Recover a spec stranded by an out-of-order click (Priority: P1)

A developer is stepping through a spec one phase at a time. They click the next-step button before the current step has finished, which leaves the spec in a state where the normal lifecycle buttons no longer let them continue. Instead of opening `.spec-context.json` and editing it by hand, they right-click the spec in the sidebar, choose **Set status…**, pick the status the spec should really be at, confirm the override, and the spec is back on track. The sidebar updates immediately to reflect the new status.

**Why this priority**: This is the entire point of the feature. Without it, the only recovery is a fragile hand-edit of a JSON file, which the issue calls out as the problem to fix.

**Independent Test**: Right-click any spec in the sidebar, choose Set status…, pick a status, confirm, and observe the spec's badge/icon change to match the chosen status — all without touching any file by hand.

**Acceptance Scenarios**:

1. **Given** a spec shown in the sidebar, **When** the developer right-clicks it, **Then** a Set status… menu item appears.
2. **Given** the developer chose Set status…, **When** the picker opens, **Then** it lists the eight canonical lifecycle statuses (specifying, specified, planning, planned, ready-to-implement, implementing, implemented, completed).
3. **Given** the developer picks a status, **When** a confirm prompt asks "Force status to X?", **Then** choosing confirm writes the new status and choosing cancel writes nothing.
4. **Given** the override is confirmed, **When** the write completes, **Then** the status is written through the sanctioned writer (not a raw JSON edit) and a history event authored by the user is appended.
5. **Given** the override is confirmed, **When** the write completes, **Then** the sidebar refreshes so the spec reflects the new status.

### User Story 2 - Reach the action without the right-click menu (Priority: P2)

A developer who prefers hovering over right-clicking sees a small inline action on the spec row that opens the same Set status… picker.

**Why this priority**: Discoverability. The right-click menu is the primary entry point; the hover action is a convenience that surfaces the same command.

**Independent Test**: Hover a spec row in the sidebar and confirm the inline Set status… action is present and opens the same picker.

**Acceptance Scenarios**:

1. **Given** a spec row in the sidebar, **When** the developer hovers it, **Then** an inline Set status… action is shown.
2. **Given** the inline action is clicked, **When** it fires, **Then** it opens the same picker and confirm flow as the right-click item.

## Edge Cases

- The developer cancels the picker (no status chosen): nothing is written, no refresh.
- The developer picks a status but cancels the confirm: nothing is written.
- The spec is already `completed`: the picker still lets the user pick any status by explicit choice, but the action itself must never auto-downgrade a completed spec silently.
- The action fires on a node that is not a spec (e.g. a document child): it resolves the spec directory or no-ops rather than corrupting state.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST surface a "Set status…" action as a right-click context-menu item on the spec name node in the SpecKit Companion sidebar tree (for active, completed, and archived spec nodes).
- **FR-002**: The system MUST surface the same "Set status…" action as a hover/inline action on the spec row.
- **FR-003**: Choosing the action MUST show a picker listing the eight canonical lifecycle statuses: specifying, specified, planning, planned, ready-to-implement, implementing, implemented, completed.
- **FR-004**: After a status is picked, the system MUST show a confirm prompt worded "Force status to X?" before writing.
- **FR-005**: On confirm, the system MUST write the chosen status through the sanctioned status writer (the existing `forceStatus` path that wraps `specContextWriter`), never by hand-editing `.spec-context.json`.
- **FR-006**: The write MUST append a history event authored by the user (`by: user`).
- **FR-007**: After a successful write, the system MUST refresh the sidebar tree provider so the spec reflects the new status.
- **FR-008**: The action MUST NOT auto-downgrade a `completed` spec; any status change away from completed happens only by the user's explicit pick.
- **FR-009**: If the picker or confirm is cancelled, the system MUST write nothing and not refresh.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A developer can move a stranded spec to any chosen lifecycle status in under 5 seconds without opening any file.
- **SC-002**: 100% of status overrides go through the sanctioned writer and produce exactly one appended user-authored history event.
- **SC-003**: Cancelling at either prompt results in zero writes to `.spec-context.json`.

## Assumptions

- The canonical statuses offered in the picker are the eight from the issue's decided list (specifying through completed); `draft` and `archived` are not offered — archive has its own dedicated command and `draft` is the implicit pre-creation state.
- The existing `forceStatus(specDir, status, by)` helper in `stepLifecycle.ts` already appends a history event via `specContextWriter`; this feature passes `by: 'user'` and the chosen status to it.

## Verbatim Constraints

- Command id: `speckit.specs.setStatus`
- Confirm prompt copy: `Force status to {status}?`
- Menu title: `Set status…`

## Approach

- **`package.json`** — add a `speckit.specs.setStatus` command under `contributes.commands` (title `Set status…`, an icon), and two menu entries under `contributes.menus`: a `view/item/context` item and an inline (`group: inline`) item, both `when`-keyed on the spec lifecycle contextValues (`spec-active`, `spec-completed`, `spec-archived`).
- **`src/features/specs/specCommands.ts`** — register the `speckit.specs.setStatus` handler: resolve the spec dir from the tree item, show a QuickPick of the eight statuses, show a `showWarningMessage` confirm ("Force status to X?"), then call the existing `forceStatus(specDir, chosen, 'user')` and `specExplorer.refresh()`. No-op on cancel at either prompt.
- **`src/features/specs/specCommands.test.ts`** — add a unit test asserting the handler calls `forceStatus` with the chosen status and `'user'`, refreshes once, and writes nothing when cancelled.

Reuses the sanctioned `forceStatus` writer (which appends a history event via `specContextWriter`/`appendTransition`) — no new JSON-writing path.
