# Todos store — Living Spec (colocated)

> Lives next to `todos.tsx`, the code it describes. Same folder, same PR, no drift.

## Requirements

- **FR-001** All todo mutations flow through `todosReducer` (todos.tsx): add, toggle, delete, clear-completed. [observed]
- **FR-002** `TodosProvider` owns state and persists it on change. [observed]
- **FR-003** Consumers use the `useTodos` hook; the reducer is never imported by components. [observed]

### Scenario: add a todo
- WHEN a user types text and submits
- THEN the todo appears in the list as active

### Scenario: clear completed
- WHEN a user clicks "Clear completed"
- THEN completed todos are removed and active ones remain
