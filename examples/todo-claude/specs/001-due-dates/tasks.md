# Tasks: Due Dates for Todo Items

**Input**: Design documents from `/specs/001-due-dates/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md, research.md, quickstart.md

**Tests**: Not explicitly requested in the feature specification. Tests are omitted following YAGNI principle.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Project type**: Single React application
- **Source**: `src/` at repository root
- **Components**: `src/components/`
- **Utilities**: `src/utils/`
- **Types**: `src/types.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project structure and foundational types

- [ ] T001 Add `dueDate?: Date` field to Todo interface in src/types.ts
- [ ] T002 [P] Create src/utils/ directory for utility functions

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities that MUST be complete before ANY user story can be implemented

**Note**: These utilities support multiple user stories and must exist before component work begins.

- [ ] T003 [P] Create `formatDate(date: Date): string` function using Intl.DateTimeFormat in src/utils/dateUtils.ts
- [ ] T004 [P] Create `isOverdue(todo: Todo): boolean` function with completed/date checks in src/utils/dateUtils.ts
- [ ] T005 [P] Create `sortByDueDate(todos: Todo[]): Todo[]` function in src/utils/dateUtils.ts
- [ ] T006 [P] Create `serializeTodos(todos: Todo[]): string` function for localStorage in src/utils/storage.ts
- [ ] T007 [P] Create `deserializeTodos(json: string): Todo[]` function for localStorage in src/utils/storage.ts
- [ ] T008 [P] Create `saveTodos(todos: Todo[]): void` wrapper function in src/utils/storage.ts
- [ ] T009 [P] Create `loadTodos(): Todo[]` wrapper function with error handling in src/utils/storage.ts

**Checkpoint**: Foundation ready - all utility functions exist and can be imported by components

---

## Phase 3: User Story 1 - Set Due Date When Creating Todo (Priority: P1)

**Goal**: Users can optionally select a due date when creating a new todo item

**Independent Test**: Create a new todo with a date selected, verify the date is saved with the todo item

### Implementation for User Story 1

- [ ] T010 [US1] Add date input state (`dueDate: string`) to AddTodo component in src/components/AddTodo.tsx
- [ ] T011 [US1] Add `<input type="date">` element after text input in src/components/AddTodo.tsx
- [ ] T012 [US1] Update onAdd callback to pass dueDate (converted to Date or undefined) in src/components/AddTodo.tsx
- [ ] T013 [US1] Update AddTodoProps interface to accept `onAdd: (text: string, dueDate?: Date) => void` in src/components/AddTodo.tsx
- [ ] T014 [US1] Clear date input after todo submission in src/components/AddTodo.tsx
- [ ] T015 [US1] Update `addTodo` function in App.tsx to accept optional dueDate parameter in src/App.tsx
- [ ] T016 [US1] Include dueDate in new Todo object creation in src/App.tsx

**Checkpoint**: User Story 1 complete - users can create todos with optional due dates

---

## Phase 4: User Story 2 - View Due Dates on Todo Items (Priority: P1)

**Goal**: Due dates are displayed next to each todo item in human-readable format

**Independent Test**: View a list of todos with due dates and verify each displays in "Dec 15, 2025" format

### Implementation for User Story 2

- [ ] T017 [US2] Import formatDate from src/utils/dateUtils.ts in src/components/TodoItem.tsx
- [ ] T018 [US2] Add due date display element conditionally rendered when todo.dueDate exists in src/components/TodoItem.tsx
- [ ] T019 [US2] Format due date using formatDate() for display in src/components/TodoItem.tsx
- [ ] T020 [US2] Add CSS styling for due date text (gray, smaller font) in src/components/TodoItem.tsx

**Checkpoint**: User Story 2 complete - todos display their due dates in human-readable format

---

## Phase 5: User Story 3 - Identify Overdue Todos (Priority: P2)

**Goal**: Incomplete overdue todos appear in red for immediate visual identification

**Independent Test**: Create a todo with a past due date, verify it displays with red styling

### Implementation for User Story 3

- [ ] T021 [US3] Import isOverdue from src/utils/dateUtils.ts in src/components/TodoItem.tsx
- [ ] T022 [US3] Add conditional CSS class 'overdue' when isOverdue(todo) returns true in src/components/TodoItem.tsx
- [ ] T023 [US3] Define .overdue CSS class with red text color in src/components/TodoItem.tsx
- [ ] T024 [US3] Ensure overdue styling does NOT apply to completed todos (isOverdue handles this) in src/components/TodoItem.tsx

**Checkpoint**: User Story 3 complete - overdue incomplete todos are visually highlighted in red

---

## Phase 6: User Story 4 - Sort Todos by Due Date (Priority: P2)

**Goal**: Users can sort todos by due date with earliest first and no-date items last

**Independent Test**: Create multiple todos with different due dates, click sort button, verify correct order

### Implementation for User Story 4

- [ ] T025 [US4] Add sortByDueDate boolean state to App component in src/App.tsx
- [ ] T026 [US4] Create toggleSort handler function in src/App.tsx
- [ ] T027 [US4] Import sortByDueDate utility function in src/App.tsx
- [ ] T028 [US4] Add useMemo to compute displayedTodos based on sort state in src/App.tsx
- [ ] T029 [US4] Pass onSort and isSorted props to TodoList component in src/App.tsx
- [ ] T030 [US4] Update TodoListProps interface to include onSort and isSorted in src/components/TodoList.tsx
- [ ] T031 [US4] Add sort button element above todo list in src/components/TodoList.tsx
- [ ] T032 [US4] Wire sort button onClick to onSort handler in src/components/TodoList.tsx
- [ ] T033 [US4] Add visual indicator (icon or text change) when list is sorted in src/components/TodoList.tsx

**Checkpoint**: User Story 4 complete - users can sort todos by due date

---

## Phase 7: Persistence (Cross-Cutting - FR-011)

**Goal**: Due dates persist across page refreshes via localStorage

**Independent Test**: Create todo with due date, refresh page, verify todo and due date still exist

### Implementation for Persistence

- [ ] T034 Import storage utilities (saveTodos, loadTodos) in src/App.tsx
- [ ] T035 Add useEffect to load todos from localStorage on initial mount in src/App.tsx
- [ ] T036 Add useEffect to save todos to localStorage when todos state changes in src/App.tsx
- [ ] T037 Handle localStorage errors gracefully (corrupted data fallback to empty array) in src/App.tsx

**Checkpoint**: Persistence complete - todos and due dates survive page refresh

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and verification

- [ ] T038 [P] Run type-check (`npm run build`) and fix any TypeScript errors
- [ ] T039 [P] Verify all functional requirements FR-001 through FR-011 using quickstart.md checklist
- [ ] T040 Test edge case: todo due today is NOT marked overdue
- [ ] T041 Test edge case: completed todo with past due date is NOT marked overdue
- [ ] T042 Test edge case: multiple todos with same due date maintain relative order when sorted

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 (needs types.ts updated)
- **User Story 2 (Phase 4)**: Depends on Phase 2 (needs formatDate utility)
- **User Story 3 (Phase 5)**: Depends on Phase 2 (needs isOverdue utility), can run parallel with US1/US2
- **User Story 4 (Phase 6)**: Depends on Phase 2 (needs sortByDueDate utility), can run parallel with US1/US2/US3
- **Persistence (Phase 7)**: Depends on Phase 2 (needs storage utilities), can start after Phase 2
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 3 (P2)**: Can start after Foundational - Independent but builds on US2 display
- **User Story 4 (P2)**: Can start after Foundational - Independent

### Within Each User Story

- Import utilities before using them
- Update props/interfaces before component implementation
- Parent component (App.tsx) changes before child component integration
- Core implementation before styling

### Parallel Opportunities

**Phase 1**: T001 and T002 can run in parallel

**Phase 2 (All can run in parallel)**:
- T003, T004, T005 (dateUtils.ts functions)
- T006, T007, T008, T009 (storage.ts functions)

**User Stories (After Phase 2 completes)**:
- US1, US2, US3, US4 can all start in parallel
- Persistence (Phase 7) can start in parallel with user stories

---

## Parallel Example: Foundational Phase

```bash
# Launch all utility functions together (different files or isolated functions):
Task: "Create formatDate function in src/utils/dateUtils.ts"
Task: "Create isOverdue function in src/utils/dateUtils.ts"
Task: "Create sortByDueDate function in src/utils/dateUtils.ts"
Task: "Create serializeTodos function in src/utils/storage.ts"
Task: "Create deserializeTodos function in src/utils/storage.ts"
```

## Parallel Example: User Stories

```bash
# After Foundational phase, launch user stories in parallel:
Task: "User Story 1 - Set Due Date (T010-T016)"
Task: "User Story 2 - View Due Dates (T017-T020)"
Task: "User Story 3 - Identify Overdue (T021-T024)"
Task: "User Story 4 - Sort by Due Date (T025-T033)"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Set due date)
4. Complete Phase 4: User Story 2 (View due dates)
5. **STOP and VALIDATE**: Users can set and see due dates
6. Deploy/demo if ready - basic due date functionality works

### Incremental Delivery

1. Setup + Foundational + US1 + US2 + Persistence -> Core MVP (users can set and view due dates that persist)
2. Add US3 -> Overdue highlighting (enhanced visibility)
3. Add US4 -> Sorting capability (enhanced organization)
4. Polish phase -> Production-ready

### Single Developer Strategy

Recommended order for a single developer:
1. Phase 1: Setup (T001-T002)
2. Phase 2: Foundational (T003-T009)
3. Phase 7: Persistence (T034-T037) - wire up early for testing convenience
4. Phase 3: User Story 1 (T010-T016)
5. Phase 4: User Story 2 (T017-T020)
6. Phase 5: User Story 3 (T021-T024)
7. Phase 6: User Story 4 (T025-T033)
8. Phase 8: Polish (T038-T042)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable after Foundational phase
- Native HTML date input used per YAGNI principle (no external libraries)
- localStorage used for persistence per plan.md specification
- Date comparisons use ISO string format to avoid timezone issues
