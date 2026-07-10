# Tasks: Clear Completed Todos

Dependency-ordered. `[P]` marks tasks that can run in parallel with each other.

- [x] **T001** Add `clearCompleted` action type and reducer case (filter out completed todos) + `src/store/todos.tsx`
- [x] **T002** Expose `clearCompleted()` on the context value and `useTodos()` return + `src/store/todos.tsx`
- [x] **T003** Render the "Clear completed" button in TodosPage, derive `hasCompleted`, disable when no completed todos, wire click to `clearCompleted` + `src/pages/TodosPage.tsx`
- [x] **T004** [P] Unit-test the reducer's `clearCompleted` case (removes completed, keeps active, no-op when none) + `src/store/todos.test.ts`
- [x] **T005** [P] Integration test: clearing removes completed todos, button disabled when none completed, result persists across remount + `src/App.test.tsx`
- [x] **T006** Verify: run `npm test` and `npm run build`, fix any failures + (verification)
