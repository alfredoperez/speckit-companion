# Quickstart: Due Dates Feature Implementation

**Feature**: 001-due-dates | **Date**: 2025-12-02

## Prerequisites

Before implementing this feature, ensure:

1. **Test Framework Installed** (TDD requirement):
   ```bash
   npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
   ```

2. **Development Server Running** (for manual verification):
   ```bash
   npm run dev
   ```

---

## Implementation Order

Follow this order to satisfy dependencies and enable incremental testing:

### Phase 1: Foundation

| Step | File | Description |
|------|------|-------------|
| 1.1 | `vitest.config.ts` | Configure test framework |
| 1.2 | `src/test/setup.ts` | Test setup file |
| 1.3 | `package.json` | Add test scripts |
| 1.4 | `src/types.ts` | Add `dueDate?: Date` to Todo interface |

### Phase 2: Utilities

| Step | File | Description |
|------|------|-------------|
| 2.1 | `src/utils/dateUtils.ts` | `isOverdue()`, `formatDate()`, `sortByDueDate()` |
| 2.2 | `src/utils/dateUtils.test.ts` | Unit tests for date utilities |
| 2.3 | `src/utils/storage.ts` | `serializeTodos()`, `deserializeTodos()` |
| 2.4 | `src/utils/storage.test.ts` | Unit tests for storage |

### Phase 3: Components (TDD Cycle)

For each component, follow Red-Green-Refactor:

| Step | File | Description |
|------|------|-------------|
| 3.1 | `src/components/AddTodo.test.tsx` | Tests for date picker |
| 3.2 | `src/components/AddTodo.tsx` | Add date input field |
| 3.3 | `src/components/TodoItem.test.tsx` | Tests for due date display & overdue styling |
| 3.4 | `src/components/TodoItem.tsx` | Display due date, apply overdue styling |
| 3.5 | `src/components/TodoList.test.tsx` | Tests for sort button |
| 3.6 | `src/components/TodoList.tsx` | Add sort button |

### Phase 4: Integration

| Step | File | Description |
|------|------|-------------|
| 4.1 | `src/App.test.tsx` | Integration tests for full flow |
| 4.2 | `src/App.tsx` | Wire up state, persistence, sorting |

---

## Key Files to Modify

### `src/types.ts`
```typescript
export interface Todo {
  id: string
  text: string
  completed: boolean
  createdAt: Date
  dueDate?: Date  // ADD THIS LINE
}
```

### `src/utils/dateUtils.ts` (NEW FILE)
```typescript
export function isOverdue(todo: Todo): boolean { ... }
export function formatDate(date: Date): string { ... }
export function sortByDueDate(todos: Todo[]): Todo[] { ... }
```

### `src/utils/storage.ts` (NEW FILE)
```typescript
export function serializeTodos(todos: Todo[]): string { ... }
export function deserializeTodos(json: string): Todo[] { ... }
export function saveTodos(todos: Todo[]): void { ... }
export function loadTodos(): Todo[] { ... }
```

### `src/components/AddTodo.tsx`
- Add `<input type="date">` after text input
- Update `onAdd` prop to include optional `dueDate`
- Handle date state with `useState`

### `src/components/TodoItem.tsx`
- Import `isOverdue`, `formatDate` from utils
- Display formatted due date next to todo text
- Apply red styling when `isOverdue(todo)` returns true

### `src/components/TodoList.tsx`
- Add sort button above list
- Accept `onSort` and `isSorted` props
- Render button with appropriate label

### `src/App.tsx`
- Add `sortByDueDate` state
- Use `useMemo` for sorted todos display
- Implement localStorage persistence with `useEffect`
- Update `addTodo` to accept optional `dueDate`

---

## Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- src/utils/dateUtils.test.ts

# Run with coverage
npm test -- --coverage
```

---

## Verification Checklist

After implementation, verify each requirement:

- [ ] **FR-001**: Date picker visible on todo creation form
- [ ] **FR-002**: Can create todo without due date
- [ ] **FR-003**: Due date displays in "Dec 15, 2025" format
- [ ] **FR-004**: No date indicator for todos without due date
- [ ] **FR-005**: Incomplete overdue todos show in red
- [ ] **FR-006**: Completed todos never show overdue styling
- [ ] **FR-007**: Today's date not marked overdue
- [ ] **FR-008**: Sort button visible
- [ ] **FR-009**: Sorting puts earliest dates first
- [ ] **FR-010**: Todos without dates appear last when sorted
- [ ] **FR-011**: Todos persist across page refresh

---

## Common Gotchas

1. **Date Timezone Issues**: Always use `toISOString().split('T')[0]` for date-only comparisons
2. **Sort Stability**: JavaScript's `sort()` is not guaranteed stable; use index comparison for ties
3. **localStorage Parsing**: Always handle `JSON.parse()` errors for corrupted data
4. **Type Safety**: Remember `dueDate` is optional - check for `undefined` before operations
