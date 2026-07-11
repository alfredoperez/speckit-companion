# Codebase Concerns

**Analysis Date:** 2026-07-10

## Tech Debt

**Inline Styles Throughout Codebase:**
- Issue: All components (`AddTodo.tsx`, `TodoItem.tsx`, `Header.tsx`, `TodoList.tsx`, `App.tsx`, `TodosPage.tsx`) use inline `style` attributes instead of CSS classes or styled components. This makes styling fragile, hard to maintain, and difficult to theme consistently.
- Files: `src/components/AddTodo.tsx`, `src/components/TodoItem.tsx`, `src/components/Header.tsx`, `src/components/TodoList.tsx`, `src/App.tsx`, `src/pages/TodosPage.tsx`
- Impact: Styling becomes increasingly difficult to maintain as the app grows; no single place to adjust colors, spacing, or responsive behavior; duplication of style objects (e.g., `{ padding: '8px 16px' }` repeated in multiple buttons).
- Fix approach: Migrate to a CSS file or CSS-in-JS solution (e.g., CSS Modules or styled-components). Create a `styles/` directory with component-scoped or global styles.

**Missing ESLint and Prettier Configuration:**
- Issue: No linting rules or code formatting configuration defined. TypeScript strict mode is enabled but no style guide enforced.
- Files: Root directory (no `.eslintrc.*`, `.prettierrc*` present)
- Impact: Team members may format code inconsistently; no automated detection of unused variables, missing dependencies, or accessibility issues.
- Fix approach: Add ESLint config targeting React 18 (with `eslint-plugin-react-hooks` and `eslint-plugin-jsx-a11y`) and Prettier config. Include `npm run lint` and `npm run format` scripts.

**Hard-coded Storage Key:**
- Issue: The storage key `'todos'` is defined once in `src/store/todos.tsx` but is a magic string that couples the component to the storage mechanism.
- Files: `src/store/todos.tsx` (line 5)
- Impact: If the storage key ever needs to change, it requires editing the store directly; no central location for configuration.
- Fix approach: Extract storage key to a constants file (`src/lib/storageKeys.ts`) so it can be reused and easily updated.

## Known Bugs

**Crypto.randomUUID() Not Available in jsdom Test Environment:**
- Symptoms: Tests rely on a polyfill in `vitest.setup.ts` because `crypto.randomUUID()` is not natively available in jsdom. The polyfill uses a deterministic counter.
- Files: `vitest.setup.ts` (lines 6-14), `src/store/todos.tsx` (line 18)
- Trigger: Run tests with jsdom environment (current configuration)
- Impact: While tests pass, the polyfill masks a potential real-world issue if the app ever runs in an environment without `crypto.randomUUID()` (e.g., older browsers, older Node.js versions). The deterministic ID generation is only valid for tests, not production.
- Workaround: Use the polyfill in tests (current); in production, ensure target browsers support the Crypto API or provide a fallback (e.g., `nanoid`, `uuid` package).
- Fix approach: Add a comment explaining the polyfill dependency or consider using a UUID library to avoid the browser API dependency entirely.

## Security Considerations

**Silent Storage Errors Mask Failures:**
- Risk: The `save()` and `load()` functions in `src/lib/storage.ts` catch all errors silently with empty catch blocks (lines 7-9, 15-17). Users receive no feedback if their todos fail to persist (e.g., localStorage is disabled, quota exceeded, or corrupted data).
- Files: `src/lib/storage.ts`
- Current mitigation: `load()` returns a fallback value (empty array) so the app doesn't crash. This prevents data loss from being obvious.
- Recommendations: (1) Log errors to console in development (e.g., `console.error('Failed to load todos:', error)`). (2) Add optional error callbacks to the storage functions so the UI layer can show a toast/alert to the user. (3) Add a health check in `TodosProvider` on mount to detect and warn about persistent storage failures.

**No Error Boundary:**
- Risk: Any unhandled error in a component will crash the entire app with a blank white screen. Users lose access to their todos and see no error message.
- Files: `src/App.tsx`, `src/main.tsx`
- Current mitigation: None. React Strict Mode is enabled (good for catching errors in development) but provides no runtime protection.
- Recommendations: Add an Error Boundary component that wraps the app and displays a graceful error page with a reload button. See: `src/components/ErrorBoundary.tsx` (does not exist yet).

**Missing Input Validation:**
- Risk: The `AddTodo` component only trims whitespace before accepting input (line 12 in `AddTodo.tsx`). No length limits, character restrictions, or XSS prevention beyond React's automatic escaping.
- Files: `src/components/AddTodo.tsx`
- Current mitigation: React escapes output by default; form only accepts text via onChange (safe from injection if storage and rendering are consistent).
- Recommendations: (1) Add a maximum length limit (e.g., 500 chars) to prevent storage bloat. (2) Reject truly empty strings (already done with `.trim()`). (3) Validate `Todo` objects on load from storage in case localStorage is corrupted.

## Performance Bottlenecks

**No Optimizations for Large Todo Lists:**
- Problem: If a user accumulates hundreds or thousands of todos, the app will re-render the entire list on every change (new todo, toggle, delete). No memoization or virtualization in place.
- Files: `src/components/TodoList.tsx` (renders all todos), `src/store/todos.tsx` (single reducer dispatches to all listeners)
- Current capacity: Likely acceptable up to 100–200 todos; beyond that, noticeable lag on older devices.
- Scaling path: (1) Add `useMemo` to `TodoList` to memoize the mapped items. (2) Add `useCallback` to dispatch functions in the context to prevent unnecessary re-renders. (3) If todos exceed 1,000, implement a virtual scrolling library (e.g., `react-window`).

**No Performance Monitoring:**
- Problem: No metrics on render times, storage operations, or memory usage. Performance regressions would go undetected.
- Files: App-wide
- Scaling path: Add performance marks (e.g., `performance.mark()`) in `TodosProvider` around storage writes, and log if operations exceed a threshold (e.g., 100ms).

## Fragile Areas

**TodosContext with Null Initialization:**
- Files: `src/store/todos.tsx` (line 39: `createContext<TodosContextValue | null>(null)`)
- Why fragile: The context is initialized as `null`, requiring a runtime check in `useTodos()` (line 61) to throw if used outside a provider. If the check is accidentally removed or bypassed, the app crashes at call time.
- Safe modification: Keep the null check in `useTodos()` (current pattern is correct). Consider adding a TypeScript helper to make the pattern more explicit (e.g., `assertContext()`).
- Test coverage: `src/store/todos.tsx` is not directly tested for the error case (calling `useTodos()` outside a provider). Integration tests in `App.test.tsx` cover the happy path.

**Storage Persistence Across Component Remounts:**
- Files: `src/store/todos.tsx` (line 42: lazy initializer), `src/App.test.tsx` (lines 20–28: integration test for persistence)
- Why fragile: The `useReducer` lazy initializer ensures todos are loaded from storage on first mount, and a `useEffect` saves on every state change (line 44–46). This works but relies on careful sequencing: if localStorage is temporarily unavailable, data could be lost or duplicated on undo.
- Safe modification: Add logging to track when load/save happens. Consider debouncing the save effect to avoid thrashing storage on rapid changes.
- Test coverage: `App.test.tsx` tests persistence across unmount/remount; edge cases (e.g., corrupted localStorage during save) are not tested.

**Component Test Coverage Gaps:**
- Files: `src/components/` (AddTodo.tsx, TodoItem.tsx, Header.tsx, TodoList.tsx have NO unit tests)
- Why fragile: Individual components are only tested indirectly via `App.test.tsx` integration tests. A change to `TodoItem` or `AddTodo` could break them without failing any unit test.
- Safe modification: Add unit tests for each component (isolate with Vitest snapshots or direct renders).
- Test coverage:
  - `AddTodo.tsx`: No unit test (integration test only)
  - `TodoItem.tsx`: No unit test (integration test only)
  - `Header.tsx`: No unit test (integration test only)
  - `TodoList.tsx`: No unit test (integration test only)
  - `App.tsx`: 5 integration tests covering add, clear, toggle, and route navigation
  - `todos.tsx` reducer: 4 unit tests covering clearCompleted
  - `storage.ts`: 2 unit tests covering happy path; error cases NOT tested

## Test Coverage Gaps

**Storage Error Scenarios Not Tested:**
- What's not tested: `load()` and `save()` error paths (invalid JSON, quota exceeded, storage disabled)
- Files: `src/lib/storage.test.ts` (only 2 happy-path tests)
- Risk: If storage.js is modified in the future, error handling could break silently, leading to data loss without any warning to the user.
- Priority: Medium — add tests for: (1) `JSON.parse` throwing on corrupted data, (2) `localStorage.setItem` throwing on quota exceeded.

**Reducer Edge Cases:**
- What's not tested: Duplicate IDs, invalid action types, mutation of original state
- Files: `src/store/todos.test.ts` (only clearCompleted tested; add, toggle, delete not tested)
- Risk: Low for current implementation (immutable patterns followed), but future changes could introduce bugs.
- Priority: Low — add tests for toggle and delete actions to ensure reducer is fully covered.

**Component Interaction Edge Cases:**
- What's not tested: Rapid clicking (add multiple todos in succession), very long todo text, empty list edge states, error states
- Files: `src/App.test.tsx` covers main flows but lacks stress tests
- Risk: UI could behave unexpectedly under heavy interaction or with edge-case data.
- Priority: Low for a small sandbox app, but important if the app ever grows.

## Missing Critical Features

**No Accessibility Support:**
- Problem: Buttons and form inputs lack `aria-label`, `aria-describedby`, or other accessibility attributes. The "Clear completed" button state change is not announced to screen readers.
- Blocks: Screen reader users cannot effectively use the app.
- Recommendation: Add `aria-label="Add a new todo"` to the input, `aria-label="Delete"` to delete buttons, and consider adding `aria-live="polite"` to the empty state message.

**No Responsive Design:**
- Problem: The app is hardcoded to 600px max-width with fixed padding. On mobile, this may be too narrow or not optimize for touch.
- Blocks: Mobile-first UX is compromised.
- Recommendation: Add media queries or use CSS Grid/Flexbox to adapt to smaller screens.

---

*Concerns audit: 2026-07-10*
