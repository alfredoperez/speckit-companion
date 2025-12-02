# Data Model: Due Dates Feature

**Feature**: 001-due-dates | **Date**: 2025-12-02

## Entities

### Todo (Extended)

The existing `Todo` interface is extended with an optional due date field.

```typescript
// src/types.ts
export interface Todo {
  id: string           // Unique identifier (UUID)
  text: string         // Todo description
  completed: boolean   // Completion status
  createdAt: Date      // Creation timestamp
  dueDate?: Date       // NEW: Optional due date (date-only, no time)
}
```

**Field Details**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique UUID generated via `crypto.randomUUID()` |
| `text` | `string` | Yes | User-entered todo description |
| `completed` | `boolean` | Yes | Whether the todo is marked complete |
| `createdAt` | `Date` | Yes | When the todo was created |
| `dueDate` | `Date` | No | **NEW** - When the todo should be completed |

**Validation Rules**:
- `dueDate` may be `undefined` (optional field per FR-002)
- `dueDate` stores full `Date` object but only the date portion is used for comparison
- No restriction on past dates (user can set any date)

---

## Serialization Schema

For localStorage persistence (FR-011), todos are serialized as JSON.

### Storage Format

```typescript
// Serialized structure in localStorage
interface SerializedTodo {
  id: string
  text: string
  completed: boolean
  createdAt: string    // ISO 8601 timestamp
  dueDate?: string     // ISO 8601 date string (YYYY-MM-DD) or undefined
}
```

### Storage Key

```typescript
const STORAGE_KEY = 'todos'
```

### Serialization Functions

```typescript
// src/utils/storage.ts

export function serializeTodos(todos: Todo[]): string {
  return JSON.stringify(todos.map(todo => ({
    ...todo,
    createdAt: todo.createdAt.toISOString(),
    dueDate: todo.dueDate?.toISOString().split('T')[0]
  })))
}

export function deserializeTodos(json: string): Todo[] {
  const data: SerializedTodo[] = JSON.parse(json)
  return data.map(item => ({
    ...item,
    createdAt: new Date(item.createdAt),
    dueDate: item.dueDate ? new Date(item.dueDate + 'T00:00:00') : undefined
  }))
}
```

---

## Derived State

### Overdue Status

Overdue status is a computed property, not stored.

```typescript
// src/utils/dateUtils.ts

export function isOverdue(todo: Todo): boolean {
  if (todo.completed) return false
  if (!todo.dueDate) return false

  const today = new Date().toISOString().split('T')[0]
  const due = todo.dueDate.toISOString().split('T')[0]
  return due < today
}
```

**Rules** (from spec):
- Completed todos are NEVER overdue (FR-006)
- Todos without due dates are NEVER overdue
- Today's date is NOT overdue (FR-007)
- Only incomplete todos with past due dates are overdue (FR-005)

---

### Sorted Todos

Sort order is computed from the current todo list.

```typescript
// src/utils/dateUtils.ts

export function sortByDueDate(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    // Both have no date - maintain original order
    if (!a.dueDate && !b.dueDate) return 0
    // No date goes to end
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    // Compare dates (earliest first)
    return a.dueDate.getTime() - b.dueDate.getTime()
  })
}
```

**Rules** (from spec):
- Earliest due dates first (FR-009)
- Todos without due dates at end (FR-010)
- Same due date: maintain relative order (stable sort)

---

## Component Props Extensions

### AddTodoProps

```typescript
interface AddTodoProps {
  onAdd: (text: string, dueDate?: Date) => void  // CHANGED: added dueDate
}
```

### TodoItemProps

No change needed - receives full `Todo` object which now includes `dueDate`.

### TodoListProps

```typescript
interface TodoListProps {
  todos: Todo[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onSort: () => void              // NEW: sort handler
  isSorted: boolean               // NEW: current sort state
}
```

---

## State Shape

### App Component State

```typescript
// src/App.tsx
const [todos, setTodos] = useState<Todo[]>([])
const [sortByDueDate, setSortByDueDate] = useState(false)  // NEW
```

---

## Entity Relationships

```
┌─────────────┐
│    Todo     │
├─────────────┤
│ id          │──── Primary key (UUID)
│ text        │
│ completed   │──── Determines overdue eligibility
│ createdAt   │
│ dueDate?    │──── Optional, drives:
└─────────────┘     • Display in TodoItem
                    • Overdue styling (computed)
                    • Sort order (computed)
```

No external entity relationships. Due date is a property of the Todo entity.
