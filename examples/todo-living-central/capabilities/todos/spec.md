# Todos — Living Spec

> Synced with the code it describes. Loaded as context into new runs that touch `src/**`.

## Purpose

Own how a todo is created, completed, and removed, and keep that state durable across
reloads — so the rest of the app reads todos through one path instead of each screen
reaching for storage or reducer internals on its own.

## Requirements

### Todo state changes through a single reducer

All mutations to the todo list SHALL go through one reducer, so every change is
expressible as a named action and no component mutates the list directly.

#### Scenario: a component changes the list
- **WHEN** a component adds, toggles, or deletes a todo
- **THEN** the change is dispatched as an action to the reducer
- **AND** no component writes to the todo collection directly

### Todos survive a reload

The todo list SHALL be persisted locally and restored on load, so a user who
refreshes or reopens the app does not lose their list.

#### Scenario: the user reloads the page
- **WHEN** a user with existing todos reloads
- **THEN** the previously saved list is restored
- **AND** completion state is preserved for each todo

### Consumers read todos through the hook

Components SHALL consume todos through the shared hook rather than the reducer or
storage layer, so the internal state shape stays free to change.

#### Scenario: a new screen needs the todo list
- **WHEN** a component needs to read or change todos
- **THEN** it uses the todos hook
- **AND** it does not import the reducer or the storage helpers

### Users can add a todo

A user SHALL be able to add a todo by entering text, and it starts active.

#### Scenario: add a todo
- **WHEN** a user types text and submits
- **THEN** the todo appears in the list as active

### Users can clear completed todos

A user SHALL be able to remove all completed todos in one action, leaving active
ones untouched. Added by spec `001-clear-completed`.

#### Scenario: clear completed
- **WHEN** a user clicks "Clear completed"
- **THEN** all completed todos are removed and active ones remain

## Uncovered

- Keyboard navigation of the list. [inferred]
