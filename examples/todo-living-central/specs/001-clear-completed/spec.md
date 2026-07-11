# Feature Specification: Clear Completed Todos

**Feature branch**: `001-clear-completed`
**Created**: 2026-07-01
**Status**: specified

## User Scenarios & Testing

### User Story 1 - Clear all completed todos in one action (Priority: P1)

A person has worked through several items on their list and checked a few off. Rather than deleting each finished item one at a time, they press a single "Clear completed" control and every checked-off item disappears at once, leaving only the work that still remains.

**Why this priority**: This is the entire feature and the MVP. Without it there is no way to bulk-remove finished work; every other story only refines the edges around it.

**Independent Test**: Add three todos, check two of them, press "Clear completed", and confirm only the one unchecked todo remains and the two checked ones are gone.

**Acceptance Scenarios**:

1. **Given** a list with both completed and active todos, **When** the person presses "Clear completed", **Then** every completed todo is removed and every active todo stays in place.
2. **Given** a list where all todos are completed, **When** the person presses "Clear completed", **Then** the list becomes empty and shows the empty-state message.
3. **Given** the list has just been cleared of completed todos, **When** the view re-renders, **Then** it immediately reflects the remaining todos with no manual refresh.

### User Story 2 - Avoid a no-op action when nothing is completed (Priority: P2)

When there is nothing checked off, the "Clear completed" control communicates that there is nothing to clear, so the person is never misled into pressing a button that does nothing.

**Why this priority**: A safety/clarity refinement on top of P1. The core clearing still works without it, but it prevents a confusing dead button.

**Independent Test**: With a list that has zero completed todos (either all active, or no todos at all), confirm the "Clear completed" control is disabled and pressing it changes nothing.

**Acceptance Scenarios**:

1. **Given** a list with active todos but none completed, **When** the person views the list, **Then** the "Clear completed" control is disabled.
2. **Given** an empty list with no todos at all, **When** the person views the page, **Then** the "Clear completed" control is disabled.
3. **Given** the "Clear completed" control is disabled, **When** the person attempts to press it, **Then** the list is unchanged.

### User Story 3 - Cleared list stays cleared after reload (Priority: P2)

After clearing completed items, the person can close and reopen the app and the finished items are still gone, so the cleanup is durable rather than a temporary view change.

**Why this priority**: Persistence is expected behavior for this app (all todo changes already persist), so clearing must persist too; it is P2 only because the visible clearing (P1) is what delivers the headline value.

**Independent Test**: Clear completed todos, reload the app, and confirm the completed todos are still gone and the remaining todos are intact.

**Acceptance Scenarios**:

1. **Given** completed todos have been cleared, **When** the app is reloaded, **Then** the cleared todos do not reappear and the remaining active todos are unchanged.

### Edge Cases

- No completed todos present (all active): the control is disabled and pressing it is a no-op.
- No todos at all: the control is disabled; the empty-state message continues to show.
- All todos completed: clearing empties the list and the empty-state message appears.
- Re-render correctness: the list updates immediately after clearing with no stale rows.
- Persistence: the result survives a reload.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST provide a single "Clear completed" control on the todos page.
- **FR-002**: Pressing the control MUST remove every todo marked completed and leave every active (uncompleted) todo unchanged.
- **FR-003**: The control MUST be disabled when there are no completed todos (including when there are no todos at all).
- **FR-004**: The list MUST re-render immediately after clearing so the removed todos are no longer shown without any manual refresh.
- **FR-005**: The result of clearing MUST persist across reloads through the app's existing persistence path.
- **FR-006**: Clearing MUST NOT alter the identity, text, order, or completed state of any remaining active todo.

### Key Entities

- **Todo**: an item with an id, text, a completed flag, and a creation timestamp. Clearing operates by removing every Todo whose completed flag is true.

## Success Criteria

### Measurable Outcomes

- **SC-001**: From a list containing at least one completed and one active todo, a single press of the control removes 100% of completed todos and retains 100% of active todos.
- **SC-002**: When zero todos are completed, the control is non-interactive (disabled) 100% of the time.
- **SC-003**: After clearing and reloading, 0 previously-cleared todos reappear.
- **SC-004**: The visible list reflects the cleared result within the same render cycle (no manual refresh required).

## Assumptions

- The control lives on the main todos page alongside the add form and list, since that is where todos are shown and managed.
- "Disabled when nothing to clear" was chosen over "hidden" so the affordance's location stays stable and discoverable; a disabled button is clearer than a vanishing one.
- No undo of a clear is required (consistent with the existing single-item Delete, which also has no undo).
- Clearing removes items permanently, matching the existing Delete semantics and persistence model.

## Approach

Small, store-first change following the app's reducer + context convention. Files to touch:

- `src/store/todos.tsx` — add a `clearCompleted` action to the reducer (filter out `completed` todos), expose `clearCompleted()` on the context value, and add it to `useTodos()`. Persistence is automatic via the existing `useEffect` that saves on `todos` change.
- `src/pages/TodosPage.tsx` — pull `clearCompleted` (and derive whether any todo is completed) from the store, render the "Clear completed" button, disable it when nothing is completed, and wire its click to `clearCompleted`.
- `src/store/todos.test.ts` (new) — unit-test the reducer's `clearCompleted` case (removes completed, keeps active, no-op on empty).
- `src/App.test.tsx` — add an integration test covering the button clearing completed todos, staying disabled when nothing is completed, and persistence across a remount.

Dependencies: none new. Reuses `src/lib/storage.ts` persistence indirectly through the store's existing save effect.
