<!-- refreshed: 2026-07-10 -->
# Architecture

**Analysis Date:** 2026-07-10

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                         Browser Entry                        │
│                     `index.html` + `main.tsx`                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      React App Layer                         │
│  `App.tsx` — Routes + TodosProvider + Layout                │
├──────────────────┬──────────────────┬───────────────────────┤
│  Header Comp     │  TodosPage       │   AboutPage           │
│  `components/`   │  `pages/`        │   `pages/`            │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         └──────────────────┴─────────────────────┤
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               State Management Layer                         │
│  Context + useReducer — `src/store/todos.tsx`              │
│  - Actions: add, toggle, delete, clearCompleted            │
│  - State: Todo[]                                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Storage Layer                              │
│  localStorage wrapper — `src/lib/storage.ts`               │
│  - load<T>() / save<T>()                                    │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App | Main component, routing setup, TodosProvider wrapper | `src/App.tsx` |
| Header | Navigation and page title | `src/components/Header.tsx` |
| TodosPage | Route component for todo list view, button layout | `src/pages/TodosPage.tsx` |
| AboutPage | Route component for about page | `src/pages/AboutPage.tsx` |
| AddTodo | Form input for new todos | `src/components/AddTodo.tsx` |
| TodoList | Renders list of todos, handles empty state | `src/components/TodoList.tsx` |
| TodoItem | Single todo row with checkbox and delete button | `src/components/TodoItem.tsx` |
| TodosProvider | Exposes todos context and dispatch actions | `src/store/todos.tsx` |
| todosReducer | Reducer function for todos state transitions | `src/store/todos.tsx` |

## Pattern Overview

**Overall:** React Context + useReducer with localStorage persistence

**Key Characteristics:**
- Single global state context (`TodosProvider`) manages all todo data
- Reducer pattern (`todosReducer`) handles all state mutations
- localStorage synced automatically via useEffect side effect
- Stateless, presentation-focused components receive data and callbacks as props
- React Router for client-side navigation between pages
- TypeScript strict mode for type safety

## Layers

**Route Layer:**
- Purpose: Client-side routing and page structure
- Location: `src/App.tsx`, `src/pages/`
- Contains: Route definitions via React Router, page-level components
- Depends on: Context (useTodos hook)
- Used by: Browser navigation

**Component Layer:**
- Purpose: Reusable UI building blocks
- Location: `src/components/`
- Contains: Presentation components (Header, TodoItem, TodoList, AddTodo)
- Depends on: Types, Context via useTodos, React hooks (useState)
- Used by: Pages and other components

**State Management Layer:**
- Purpose: Centralized todo state and business logic
- Location: `src/store/todos.tsx`
- Contains: Context creation, reducer, provider component, custom hook
- Depends on: Types, storage layer
- Used by: All components consuming todos via useTodos

**Storage Layer:**
- Purpose: Abstraction over browser localStorage for all persistence
- Location: `src/lib/storage.ts`
- Contains: Generic load/save functions with JSON serialization and error handling
- Depends on: None (browser APIs only)
- Used by: TodosProvider on mount and after state changes

**Type Layer:**
- Purpose: Shared type definitions
- Location: `src/types.ts`
- Contains: Todo interface (id, text, completed, createdAt)
- Depends on: None
- Used by: All components and store

## Data Flow

### Primary Request Path: Add Todo

1. User types in input field and clicks Add button (`src/components/AddTodo.tsx`)
2. AddTodo component calls `onAdd(text.trim())` prop callback
3. Callback dispatches `{ type: 'add', text }` action to reducer
4. `todosReducer` creates new Todo with UUID, completed=false, ISO timestamp
5. Reducer returns new state array with appended todo
6. TodosProvider re-renders with new state
7. useEffect in TodosProvider calls `save()` to localStorage
8. All subscribers via `useTodos()` hook receive updated state
9. TodoList and TodoItem components re-render with new todo visible

### Secondary Flow: Toggle Completion

1. User clicks checkbox on TodoItem (`src/components/TodoItem.tsx`)
2. Input onChange handler calls `onToggle(todo.id)` callback
3. Callback dispatches `{ type: 'toggle', id }` action
4. Reducer toggles `completed` flag on matching todo
5. Same save-to-storage and re-render cascade as above

### State Management:

- **State source:** Context stored in TodosProvider
- **Mutation method:** Controlled via actions dispatched to reducer
- **Persistence:** Automatic via useEffect → storage.save() when todos array changes
- **Hydration:** On TodosProvider mount, useReducer initializer calls storage.load() to restore from localStorage with fallback to empty array
- **Subscribers:** Any component calling `useTodos()` hook gets reactive updates

## Key Abstractions

**TodosContextValue:**
- Purpose: Typed interface for context value passed to consumers
- Exposes: todos state array + 4 action functions (addTodo, toggleTodo, deleteTodo, clearCompleted)
- Pattern: Encapsulates all todo operations as methods, hiding dispatch mechanism from consumers
- Located: `src/store/todos.tsx`

**Action Union Type:**
- Purpose: Discriminated union of all possible reducer actions
- Ensures: Type-safe dispatch calls with required fields per action type
- Pattern: `{ type: 'add'; text: string } | { type: 'toggle'; id: string } | …`
- Located: `src/store/todos.tsx`

**Storage Generic Functions:**
- Purpose: Adapter between runtime state and browser persistence
- Generic over type T to support any JSON-serializable data
- Pattern: Try-catch wrapper around localStorage with fallback values
- Located: `src/lib/storage.ts`

## Entry Points

**Browser Entry:**
- Location: `index.html`
- Triggers: Page load
- Responsibilities: Defines root div and loads module script

**JavaScript Entry:**
- Location: `src/main.tsx`
- Triggers: Called by index.html script tag
- Responsibilities: Creates React root and renders App wrapped in BrowserRouter

**App Component:**
- Location: `src/App.tsx`
- Triggers: Rendered from main.tsx
- Responsibilities: Sets up TodosProvider context, routes, and layout wrapper

## Architectural Constraints

- **Single Provider:** All todo state centralized in one TodosProvider — no multiple stores or slices (appropriate for this small app)
- **Synchronous Reducer:** todosReducer is pure and synchronous; no async middleware or side effects (keeping it simple for a demo app)
- **localStorage Persistence:** Automatic sync after state changes; no manual serialization needed in components
- **Global State:** TodosProvider must wrap entire app tree; no partial subtree opt-out possible (acceptable given single-feature scope)
- **No error recovery:** If localStorage fails, app silently falls back to in-memory state and empty array on reload; no retry or persistence recovery UI

## Anti-Patterns

### Props Drilling Through Multiple Levels

**What happens:** Data passed from App → TodosPage → TodoList → TodoItem instead of using context

**Why it's wrong:** Intermediate components (TodoList) become transport layers carrying data they don't use, making refactoring harder and harder to add new data consumers

**Do this instead:** Use `useTodos()` hook directly in leaf components that need data. TodoList becomes a pure container mapping todos array; TodoItem pulls its own callbacks via the hook.

### Inline State in Reducer-Managed Component

**What happens:** Adding local useState in TodosPage or other provider consumers instead of using context

**Why it's wrong:** Splinters state across hooks; makes it unclear where the source of truth lives; harder to sync across page navigation

**Do this instead:** All todo-related state in reducer, local useState only for UI-transient state like form input value (AddTodo's text input)

## Error Handling

**Strategy:** Fail-silent with fallbacks

**Patterns:**
- localStorage unavailable → silently skip save, app continues in-memory
- JSON.parse fails → return fallback value (empty array or provided default)
- context undefined (useTodos called outside TodosProvider) → throw error with clear message
- crypto.randomUUID missing → test setup provides deterministic shim

## Cross-Cutting Concerns

**Logging:** None; this is a demo app. Test fixtures (`vitest.setup.ts`) provide stubs for browser APIs.

**Validation:** Form-level only — AddTodo checks `text.trim()` before dispatch; reducer assumes valid data

**State Tracking:** vitest.setup.ts clears localStorage after each test to ensure isolation
