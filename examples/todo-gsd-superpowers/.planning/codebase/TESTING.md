# Testing Patterns

**Analysis Date:** 2026-07-10

## Test Framework

**Runner:**
- Vitest 1.6.0
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in `expect()`
- React Testing Library matchers via `@testing-library/jest-dom`

**Test Environment:**
- jsdom (browser simulation)
- Global test APIs enabled (`globals: true`)
- Automatic cleanup between tests

**Run Commands:**
```bash
npm test              # Run all tests once
npm run test:watch   # Watch mode (in package.json, not defined but vitest supports it)
npm run build        # Includes TypeScript check (tsc)
```

## Test File Organization

**Location:**
- Co-located with source files in same directory
- Pattern: `{module}.test.ts` or `{module}.test.tsx`
- Included in `tsconfig.json` `include` but explicitly excluded from compilation (`exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"]`)

**Files:**
- `src/App.test.tsx` — Integration tests for full app flow
- `src/store/todos.test.ts` — Reducer logic tests
- `src/lib/storage.test.ts` — Storage utility tests

**Naming:**
- Test files use `.test.ts` suffix (Vitest default)
- Test names describe behavior in plain English

**Structure:**
```
src/
├── App.test.tsx              # Integration tests
├── App.tsx                   # Source
├── components/
│   ├── TodoItem.tsx
│   ├── AddTodo.tsx
│   ├── Header.tsx
│   └── TodoList.tsx
├── lib/
│   ├── storage.test.ts       # Unit tests
│   └── storage.ts
├── pages/
│   ├── TodosPage.tsx
│   └── AboutPage.tsx
├── store/
│   ├── todos.test.ts         # Reducer tests
│   └── todos.tsx
└── types.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Top-level describe blocks group related functionality
describe('App', () => {
  it('shows the app title', () => {
    // Arrange, Act, Assert
  })
})

describe('Clear completed', () => {
  it('removes completed todos and keeps active ones', () => {
    // Arrange, Act, Assert
  })
})
```

**Patterns:**

**Setup Pattern:**
- `vitest.setup.ts` runs before all tests
- Provides browser shims (`crypto.randomUUID`)
- Clears localStorage after each test
- Cleans up React DOM after each test

```typescript
// From vitest.setup.ts
afterEach(() => {
  cleanup()
  localStorage.clear()
})
```

**Teardown Pattern:**
- Automatic via `afterEach()` hooks
- `cleanup()` removes rendered components
- `localStorage.clear()` resets state

**Assertion Pattern:**
- Use React Testing Library's semantic queries: `getByRole`, `getByText`, `getByPlaceholderText`
- Prefer `expect(element).toBeInTheDocument()` over `expect(element).toBeTruthy()`

```typescript
// Good — semantic query by role
expect(screen.getByRole('heading', { level: 1, name: 'Todo App' })).toBeInTheDocument()

// Good — query by placeholder (accessible)
fireEvent.change(screen.getByPlaceholderText('Add a new todo...'), { target: { value: 'write spec' } })
```

## Mocking

**Framework:** Vitest's built-in mocking (no external mocking library)

**Patterns:**
- No mock function library used (no `jest.mock()` or `vi.mock()`)
- Tests directly manipulate localStorage (not mocked)
- Tests use real React Context
- Browser APIs are shimmed in setup, not mocked per test

**What to Mock:**
- External HTTP calls (not present in this app)
- Third-party service APIs (not present in this app)

**What NOT to Mock:**
- localStorage — test with the real API (easier to test persistence)
- React Context and hooks — test with real providers
- Component rendering — use `render()` directly
- Event firing — use `fireEvent` directly

## Fixtures and Factories

**Test Data:**
- Reducer tests use a factory function for consistent test todos:

```typescript
// From src/store/todos.test.ts
function todo(id: string, completed: boolean): Todo {
  return { id, text: `todo ${id}`, completed, createdAt: '2026-07-01T00:00:00.000Z' }
}
```

- App integration tests use `renderApp()` helper to wrap routing:

```typescript
// From src/App.test.tsx
function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}
```

- Component helpers extract common flows:

```typescript
// From src/App.test.tsx (in 'Clear completed' suite)
function addTodo(text: string) {
  fireEvent.change(screen.getByPlaceholderText('Add a new todo...'), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
}
```

**Location:**
- Fixtures defined at top of test file or suite
- Factories co-located with test that uses them
- No separate `fixtures/` or `factories/` directory (too small)

## Coverage

**Requirements:** No enforced coverage target (not configured in `vitest.config.ts`)

**Current coverage:**
- `src/App.test.tsx`: Integration tests cover main flows (add, toggle, delete, clear, routing, persistence)
- `src/store/todos.test.ts`: Reducer tests cover all action types and edge cases
- `src/lib/storage.test.ts`: Basic round-trip and fallback tests

**View Coverage:**
- Vitest supports `--coverage` flag but not configured in package.json scripts
- To generate: `npx vitest run --coverage`

## Test Types

**Unit Tests:**
- **Scope:** Pure functions and reducers
- **Approach:** Test input → output with various edge cases
- **Example:** `storage.test.ts` tests `load()` and `save()` with JSON round-trip and fallback scenarios
- **Example:** `todos.test.ts` tests reducer with all action types and boundary conditions (empty list, all completed, none completed)

**Integration Tests:**
- **Scope:** Component interactions and user flows
- **Approach:** Render App with MemoryRouter, simulate user actions, assert UI state
- **Example:** `App.test.tsx` tests adding todo → persisting to localStorage → remounting → state restored
- **Example:** Clear completed button behavior across multiple todos

**E2E Tests:**
- **Framework:** Not used (would require Cypress/Playwright; dev server is lightweight enough for manual testing)
- **Manual verification:** Run `npm run dev` and exercise the flows manually

## Common Patterns

**Async Testing:**
```typescript
// Not needed in this app — no async operations
// But if needed, would use async/await in test function:
it('loads todos on mount', async () => {
  renderApp()
  await screen.findByText('my todo')  // waits for element
})
```

**Error Testing:**
```typescript
// Tested via context hook guards in integration tests
it('throws when useTodos used outside provider', () => {
  // This is implicit — if useTodos throws, test would fail loudly
  // No explicit error testing needed for this small app
})
```

**Component State Testing:**
```typescript
// Test form interaction with state change
it('clears input after submission', () => {
  renderApp()
  const input = screen.getByPlaceholderText('Add a new todo...')
  fireEvent.change(input, { target: { value: 'test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  expect(input).toHaveValue('')  // input cleared
})
```

**Persistence Testing:**
```typescript
// Unmount and remount to test localStorage survival
it('persists across remounts', () => {
  const { unmount } = renderApp()
  fireEvent.change(screen.getByPlaceholderText('Add a new todo...'), { target: { value: 'write spec' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))

  unmount()
  renderApp()
  expect(screen.getByText('write spec')).toBeInTheDocument()
})
```

**Disabled State Testing:**
```typescript
// Test that button is disabled when no completed todos
it('disables the button when nothing is completed', () => {
  renderApp()
  expect(screen.getByRole('button', { name: 'Clear completed' })).toBeDisabled()
})
```

## Key Testing Principles

- **User-centric queries:** Use `getByRole`, `getByPlaceholderText`, `getByText` — avoid implementation details like CSS selectors
- **Full-flow testing:** Test persistence, routing, and multi-step interactions, not just individual functions
- **Minimal test setup:** No mocking libraries, no fixture files — keep tests close to source
- **Edge cases:** Test empty lists, all-completed state, no-completed state, remounting, persistence

---

*Testing analysis: 2026-07-10*
