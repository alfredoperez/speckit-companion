# Feature Specification: Due Dates for Todo Items

**Feature Branch**: `001-due-dates`
**Created**: 2025-12-02
**Status**: Draft
**Input**: User description: "I want to add due dates to my todo app. Users should be able to pick a due date when creating a todo. The due date should show next to each todo item. Overdue todos should appear in red. I also want a button to sort todos by due date, with the earliest dates first and todos without dates at the end."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set Due Date When Creating Todo (Priority: P1)

As a user, I want to optionally select a due date when creating a new todo item so that I can track when tasks need to be completed.

**Why this priority**: This is the foundational capability that enables all other due date functionality. Without the ability to set due dates, no other features in this spec can function.

**Independent Test**: Can be fully tested by creating a new todo with a due date selected and verifying the date is saved with the todo item.

**Acceptance Scenarios**:

1. **Given** I am on the todo creation form, **When** I enter a todo title and select a due date from the date picker, **Then** the todo is created with the specified due date attached.
2. **Given** I am on the todo creation form, **When** I enter a todo title without selecting a due date, **Then** the todo is created without a due date (due date is optional).
3. **Given** I am selecting a due date, **When** I interact with the date picker, **Then** I can select any date including today and future dates.

---

### User Story 2 - View Due Dates on Todo Items (Priority: P1)

As a user, I want to see the due date displayed next to each todo item so that I can quickly identify when tasks are due.

**Why this priority**: Displaying due dates is essential for users to gain value from setting them. This is a core visibility feature that directly supports task management.

**Independent Test**: Can be fully tested by viewing a list of todos with due dates and verifying each due date appears next to its corresponding todo item.

**Acceptance Scenarios**:

1. **Given** a todo item has a due date set, **When** I view the todo list, **Then** the due date is displayed next to the todo item in a human-readable format.
2. **Given** a todo item has no due date, **When** I view the todo list, **Then** no due date is shown for that item (no placeholder or empty text).

---

### User Story 3 - Identify Overdue Todos (Priority: P2)

As a user, I want overdue todos to appear in red so that I can immediately identify tasks that have passed their due date.

**Why this priority**: Visual highlighting of overdue items is important for task prioritization but depends on due dates being set and displayed first.

**Independent Test**: Can be fully tested by creating a todo with a past due date and verifying it displays with red styling.

**Acceptance Scenarios**:

1. **Given** a todo item has a due date in the past (before today), **When** I view the todo list, **Then** that todo item is displayed with red text/styling to indicate it is overdue.
2. **Given** a todo item has a due date of today, **When** I view the todo list, **Then** that todo item is NOT displayed as overdue (today is not considered overdue).
3. **Given** a todo item has a due date in the future, **When** I view the todo list, **Then** that todo item is displayed in normal styling (not red).
4. **Given** a todo item has no due date, **When** I view the todo list, **Then** that todo item is displayed in normal styling (not red).

---

### User Story 4 - Sort Todos by Due Date (Priority: P2)

As a user, I want a button to sort my todos by due date so that I can view my tasks in order of urgency.

**Why this priority**: Sorting enhances the usefulness of due dates but is a secondary feature that augments the core due date functionality.

**Independent Test**: Can be fully tested by creating multiple todos with different due dates and verifying the sort button reorders them correctly.

**Acceptance Scenarios**:

1. **Given** I have multiple todos with different due dates, **When** I click the sort-by-due-date button, **Then** todos are reordered with the earliest due dates appearing first.
2. **Given** I have todos with and without due dates, **When** I click the sort-by-due-date button, **Then** todos without due dates appear at the end of the list.
3. **Given** the todos are already sorted by due date, **When** I click the sort-by-due-date button again, **Then** the sort order is maintained (earliest first, no-date items last).

---

### Edge Cases

- What happens when a todo's due date is today at 11:59 PM? The todo should NOT be marked overdue until the following day (comparison is date-only, not time-based).
- What happens when multiple todos have the same due date? They should appear together in the sorted list, maintaining their relative order among themselves.
- What happens when all todos have no due date and user clicks sort? The list order remains unchanged since all items have equal "no date" priority.
- How does the system handle completed todos with past due dates? Completed todos with past due dates should NOT display as overdue (red styling only applies to incomplete overdue todos).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a date picker control on the todo creation form for selecting a due date.
- **FR-002**: System MUST allow users to create todos without selecting a due date (due date is optional).
- **FR-003**: System MUST display the due date next to each todo item that has one, in a human-readable format (e.g., "Dec 15, 2025" or "Tomorrow").
- **FR-004**: System MUST NOT display any due date indicator for todo items without a due date.
- **FR-005**: System MUST apply red styling to incomplete todo items whose due date is before today's date.
- **FR-006**: System MUST NOT apply overdue styling to completed todo items regardless of due date.
- **FR-007**: System MUST NOT apply overdue styling to todos with due date of today or in the future.
- **FR-008**: System MUST provide a button to sort todos by due date.
- **FR-009**: System MUST sort todos with earliest due dates first when sort-by-due-date is activated.
- **FR-010**: System MUST place todos without due dates at the end of the list when sorted by due date.
- **FR-011**: System MUST persist due dates with todo items across page refreshes.

### Key Entities

- **Todo Item**: Extended to include an optional due date attribute representing the date by which the task should be completed.
- **Due Date**: A calendar date (without time component) associated with a todo item, used for display, overdue calculation, and sorting.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can set a due date on a new todo in under 5 seconds using the date picker.
- **SC-002**: 100% of todos with due dates display their due date visibly next to the todo text.
- **SC-003**: 100% of incomplete overdue todos are visually distinguishable (red styling) from non-overdue todos.
- **SC-004**: Users can sort their entire todo list by due date with a single click.
- **SC-005**: After sorting, earliest due dates appear first and todos without dates appear last, with 100% accuracy.

## Assumptions

- The existing todo app has a creation form where the date picker can be added.
- The app already persists todo data (the due date will be persisted using the same mechanism).
- Date comparison for overdue status uses the user's local date/timezone.
- The date picker allows selection of past dates (for flexibility), but overdue styling only applies to incomplete items.
- Human-readable date format follows common conventions (e.g., "Dec 15, 2025") rather than ISO format.
