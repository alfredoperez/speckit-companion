# Todos — Living Spec

> Synced with the code it describes. Loaded as context into new runs that touch `src/**`.

## Requirements

- **FR-001** Todos are managed through a single reducer (`todosReducer` in src/store/todos.tsx): add, toggle, delete, clear-completed. [observed]
- **FR-002** State survives reloads via local storage (`load`/`save` in src/lib/storage.ts). [observed]
- **FR-003** Components consume todos through the `useTodos` hook (src/store/todos.tsx), never the reducer directly. [observed]

### Users can add a todo

#### Scenario: add a todo
- WHEN a user types text and submits
- THEN the todo appears in the list as active

### Users can clear completed todos

Added by spec `001-clear-completed`; the reducer gained a `clear-completed` action.

#### Scenario: clear completed
- WHEN a user clicks "Clear completed"
- THEN all completed todos are removed and active ones remain

## Uncovered

- Keyboard navigation of the list. [inferred]
