# Coding Conventions

**Analysis Date:** 2026-07-10

## Naming Patterns

**Files:**
- React components: PascalCase (`TodoItem.tsx`, `AddTodo.tsx`, `Header.tsx`)
- Utilities and modules: camelCase (`storage.ts`, `types.ts`)
- Test files: `{module}.test.ts` or `{module}.test.tsx` (co-located with source)

**Functions:**
- Regular functions: camelCase (`load`, `save`, `useTodos`, `handleSubmit`)
- React components: PascalCase (`TodoItem`, `AddTodo`, `TodosProvider`, `TodosPage`)
- Action creators in reducers: inline functions, typed with discriminated unions

**Variables:**
- Local variables: camelCase (`text`, `completed`, `todos`, `hasCompleted`)
- Destructured props: camelCase (`{ todo, onToggle, onDelete }`)
- No Hungarian notation

**Types:**
- Interfaces: PascalCase with `Props` or `Value` suffix for clarity (`TodoItemProps`, `TodosContextValue`, `Action`)
- Exported types: PascalCase (`Todo`)
- Type definitions: in dedicated `types.ts` file or co-located in module where used

**Constants:**
- Module constants: UPPER_SNAKE_CASE (`STORAGE_KEY`)
- Used in same file scope, not exported

## Code Style

**Formatting:**
- No `.eslintrc` or `.prettierrc` file — uses Vite/TypeScript defaults
- 2-space indentation (inferred from source files)
- Semicolons present throughout
- Single quotes in JSX attributes, double quotes in strings

**Linting:**
- TypeScript strict mode enabled: `strict: true`
- Unused variable detection: `noUnusedLocals: true`, `noUnusedParameters: true`
- Case detection: `noFallthroughCasesInSwitch: true`
- Import extensions allowed: `allowImportingTsExtensions: true`

## Import Organization

**Order:**
1. React and third-party packages (`react`, `react-dom`, `react-router-dom`)
2. Relative imports from `../` (going up directories)
3. Relative imports from `./` (current directory)
4. No wildcard imports; all imports are named or default

**Path structure:**
- Components from `./components/`
- Pages from `./pages/`
- Store/context from `./store/`
- Utilities from `./lib/`
- Types from `./types`

**Example from `src/pages/TodosPage.tsx`:**
```typescript
import { useTodos } from '../store/todos'
import { AddTodo } from '../components/AddTodo'
import { TodoList } from '../components/TodoList'
```

## Error Handling

**Strategy:** Defensive fallbacks with silent failure for non-critical operations

**Patterns:**
- **Storage operations** (`src/lib/storage.ts`): Try-catch with fallback values, no error logging
  ```typescript
  export function load<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;  // Silent fallback on quota/parse error
    }
  }
  ```

- **Context consumption** (`src/store/todos.tsx`): Guard with null checks, throw meaningful errors
  ```typescript
  export function useTodos(): TodosContextValue {
    const ctx = useContext(TodosContext)
    if (!ctx) throw new Error('useTodos must be used within a TodosProvider')
    return ctx
  }
  ```

- **No global error boundary** — errors propagate up to be caught at component level or swallowed silently (by design for this small app)

## Logging

**Framework:** None — `console` APIs not used in production code

**Patterns:**
- No console.log in shipped code
- Diagnostic comments only in test setup (`vitest.setup.ts` comments explain the crypto.randomUUID shim)
- Test names are self-documenting; no logging needed to understand flow

## Comments

**When to Comment:**
- Only comment WHY, not WHAT — names and code structure should be self-explanatory
- Minimal comments; code is small enough that structure is clear
- Pragmatic comments on non-obvious workarounds only

**Examples from codebase:**
- `vitest.setup.ts`: Comments explain browser API shims required for test environment
- `storage.ts`: Single-line comment explains that all persistence goes through this module
- Component/function bodies: No comments — names and structure are clear

**No JSDoc/TSDoc** — types are explicit and visible in code; comments are unnecessary

## Function Design

**Size:** Keep functions small and focused
- Components are single-responsibility (`TodoItem`, `Header`, `AddTodo` ~30 lines max)
- Reducer cases are compact (2-4 lines per action)
- Utilities are one-liners or tightly scoped (`load`, `save` ~5 lines each)

**Parameters:**
- Props interface pattern for React components: destructure in function signature
  ```typescript
  export function TodoItem({ todo, onToggle, onDelete }: TodoItemProps) { ... }
  ```
- Callback handlers pass single IDs, not full objects

**Return Values:**
- Functions return data directly or JSX
- Reducers return new state (immutable)
- Event handlers return void (`handleSubmit`, `onToggle`, `onDelete`)

## Module Design

**Exports:**
- Named exports for everything except the root App component
- Each file exports 1-3 related items
  - `src/store/todos.tsx`: `todosReducer`, `TodosProvider`, `useTodos`
  - `src/lib/storage.ts`: `load`, `save`
  - `src/components/TodoItem.tsx`: `TodoItem`

- Default export only for `App.tsx` (entry point)

**Barrel Files:**
- Not used — imports are direct from source files

**File organization:**
- `src/types.ts`: Single source for shared type definitions
- `src/store/todos.tsx`: Context provider + reducer + hook in one file for cohesion
- `src/components/`: Each component in its own file
- `src/lib/`: Utility functions (storage, etc.)
- `src/pages/`: Page-level components that consume hooks and compose smaller components

## TypeScript Patterns

**Strict mode compliance:**
- All functions have explicit return types (inferred or declared)
- All parameters typed (no implicit `any`)
- Reducer actions use discriminated unions (`type: 'add' | 'toggle' | 'delete' | 'clearCompleted'`)
- No type assertions (`as`) except in test setup comments (`@ts-expect-error`)

**Generic functions:**
- Storage functions are generic: `load<T>`, `save<T>`
- Allows strong typing without duplicating logic

---

*Convention analysis: 2026-07-10*
