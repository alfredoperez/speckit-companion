# Tasks: Tags

Dependency-ordered, organized by user story. Each task names the exact file it creates or edits. `[P]` = runs in parallel within its wave (different file, no incomplete dependency). `[US#]` maps a task to its user story.

Test-First is required by the plan's Constitution Check (III) — each story's `### Tests` are written to fail first, then made green by its implementation.

---

## Phase 1: Setup

No setup work. Stack (React 18 + TypeScript + Vite + Vitest + react-router) and tooling are already installed and green; this feature adds files within the existing structure.

---

## Phase 2: Foundational (blocks ALL stories)

Shared types and store infrastructure every story depends on. No user-story work begins until this phase is done.

**Wave 1 — single (everything else imports these types):**

- [ ] **T001** [US1][US2][US3] Add `Tag` interface (`{ id: string; name: string }`) and add `tagIds: string[]` to the `Todo` interface · `src/types.ts`

**⟶ Wait for Wave 1 to finish, then:**

**Wave 2 — parallel (independent store files, build together):**

- [ ] **T002** [P] [US1] Create the tags store slice: `TagsProvider` (reducer + context) and `useTags()` hook mirroring `todos.tsx`, with `addTag(name)` (append `{ id: crypto.randomUUID(), name: trimmed }`; no-op when trimmed name is empty — FR-005) and `removeTag(id)` actions; seed via `load`, persist via `useEffect`/`save` under the named key `'tags'` · `src/store/tags.tsx`
- [ ] **T003** [P] [US1][US2] Extend the todos store: normalize loaded todos so a missing `tagIds` becomes `[]` (migration — FR-011); add `toggleTag(todoId, tagId)` (add the id if absent, remove if present — affects only that todo) and `removeTagFromTodos(tagId)` (strip the id from every todo's `tagIds`) actions and reducer cases; new todos start with `tagIds: []` · `src/store/todos.tsx`

**⟶ Wait for Wave 2 to finish, then:**

**Wave 3 — single (imports `TagsProvider`):**

- [ ] **T004** [US1] Wrap the app tree in `<TagsProvider>` (inside/around `<TodosProvider>`) so tags state is available to all routes · `src/App.tsx`

---

## Phase 3: User Story 1 — Create and manage tags (P1) 🎯 MVP

**Goal**: A person can open a dedicated Tags area, create tags by name, see them listed verbatim, and remove them.

**Independent Test**: Visit `/tags`, create two tags, confirm both appear by their exact names, remove one, confirm only the other remains. No todo interaction required.

### Tests

**Wave 1 — parallel (independent test files, write together — must fail first):**

- [ ] **T005** [P] [US1] Tags store tests: `addTag` appends a tag with the trimmed name; empty/whitespace-only name creates nothing (FR-005); `removeTag` drops it from the list · `src/store/tags.test.tsx`
- [ ] **T006** [P] [US1] Tags page tests (render in `<MemoryRouter>` with providers): creating a tag shows it in the list with the label matching the entered text verbatim (FR-003); removing it clears it from the list; removing an assigned tag also strips it from todos and reverts an active filter to `All` (cascade — FR-010) · `src/pages/TagsPage.test.tsx`

### Implementation

**⟶ After tests are red, build the components — Wave 2, parallel (independent files):**

- [ ] **T007** [P] [US1] `AddTag` component: name input + create action, mirrors `AddTodo`; trims input and submits via an `onAdd(name)` prop · `src/components/AddTag.tsx`
- [ ] **T008** [P] [US1] `TagList` component: renders each tag's `name` verbatim with a per-tag remove control wired to an `onRemove(id)` prop · `src/components/TagList.tsx`
- [ ] **T009** [P] [US1] Add a header nav `<Link to="/tags">Tags</Link>` (link text exactly `Tags` — FR-001) · `src/components/Header.tsx`

**⟶ Wait for Wave 2, then:**

**Wave 3 — single (wires the components + stores):**

- [ ] **T010** [US1] `TagsPage`: wire `useTags` + `useTodos`; render `AddTag` (→ `addTag`) and `TagList`; the remove handler calls both `removeTag(id)` and `removeTagFromTodos(id)` so no dangling assignment remains (FR-004, FR-010 cascade) · `src/pages/TagsPage.tsx`

**⟶ Wait for Wave 3, then:**

**Wave 4 — single (imports `TagsPage`):**

- [ ] **T011** [US1] Add the `<Route path="/tags" element={<TagsPage />} />` (route exactly `/tags` — Verbatim) · `src/App.tsx`

**Checkpoint**: The Tags area is independently functional — create, list (verbatim), and remove tags at `/tags`. US1 is demoable on its own.

---

## Phase 4: User Story 2 — Assign tags to todos (P2)

**Goal**: Each todo offers an independent on/off control per existing tag; toggling assigns/unassigns that tag for that todo only.

**Independent Test**: With a tag created, toggle it on for one todo (reads assigned), toggle off (reads unassigned); with two tags, toggle both on the same todo and confirm independence; confirm other todos are unaffected.

### Tests

**Wave 1 — single (must fail first):**

- [ ] **T012** [US2] Assignment tests (render todos page/components with providers): toggling a tag on a todo assigns it and off removes it; two tags toggle independently on one todo; toggling a tag on one todo leaves other todos unchanged (FR-006, FR-007) · `src/components/TodoItem.test.tsx`

### Implementation

**⟶ After the test is red, Wave 2 — single (leaf component first):**

- [ ] **T013** [US2] `TodoItem`: add an independent on/off control for every existing tag, reflecting whether the tag is in this todo's `tagIds`; emits via an `onToggleTag(todoId, tagId)` prop; takes the tag list as a prop · `src/components/TodoItem.tsx`

**⟶ Wait, then Wave 3 — single (parent threads props):**

- [ ] **T014** [US2] `TodoList`: thread the `tags` list and `onToggleTag` prop through to each `TodoItem` · `src/components/TodoList.tsx`

**⟶ Wait, then Wave 4 — single (page wires the store):**

- [ ] **T015** [US2] `TodosPage`: read `useTags`, pass `tags` and `toggleTag` down to `TodoList` · `src/pages/TodosPage.tsx`

**Checkpoint**: Tags can be assigned/unassigned per todo, independently across tags and todos. US1 + US2 are functional together.

---

## Phase 5: User Story 3 — Filter todos by tag (P3)

**Goal**: A filter row (`All` + one control per tag) narrows the todo list to a single tag; `All` restores the full list; removing the filtered tag reverts to `All`.

**Independent Test**: With two tags assigned to different todos, select one tag's filter → only its todos show; select `All` → all todos show again.

### Tests

**Wave 1 — single (must fail first):**

- [ ] **T016** [US3] Filter tests (render todos page with providers): selecting a tag filter shows only todos carrying it; `All` shows every todo and is the default; a tag carried by no todo yields an empty list (not an error); removing the currently-filtered tag reverts the view to `All` (FR-008, FR-009, FR-010 fallback) · `src/pages/TodosPage.filter.test.tsx`

### Implementation

**⟶ After the test is red, Wave 2 — single (new component):**

- [ ] **T017** [US3] `TagFilter` component: render a control labelled exactly `All` (Verbatim) plus one control per existing tag; emits the selected tag id (or null for `All`) via an `onSelect` prop; marks the active selection · `src/components/TagFilter.tsx`

**⟶ Wait, then Wave 3 — single (page owns filter state):**

- [ ] **T018** [US3] `TodosPage`: hold the active-filter id in local `useState` (default `All`/null); validate it against the live tag list on each render and fall back to `All` when the selected tag no longer exists (FR-010); render `TagFilter` and show only todos whose `tagIds` contains the active id, or all when `All` · `src/pages/TodosPage.tsx`

**Checkpoint**: Filtering works end to end; all three stories are functional together.

---

## Phase 6: Polish & Cross-Cutting

**Wave 1 — parallel (independent verification, run together):**

- [ ] **T019** [P] Run the full suite and production build green — `npm test` and `npm run build` · (repo root)
- [ ] **T020** [P] Validate against Success Criteria and Edge Cases: verbatim tag label (SC-001), assignment isolation (SC-002), exact filter set + `All` restore (SC-003), tags/assignments restored after reload/remount (SC-004), tag removal leaves zero dangling assignments and no error (SC-005); duplicate names allowed; toggling twice returns to original state · (manual + existing tests)

---

## Dependencies & Execution Order

- **Setup → Foundational → US1 (P1) → US2 (P2) → US3 (P3) → Polish.** Stories are in priority order; each story's checkpoint is an independently testable increment.
- **Foundational (Phase 2)**: T001 (types) → then T002 + T003 in parallel (different store files) → then T004 (App wrap, imports `TagsProvider`). Blocks every story.
- **US1 (Phase 3)**: tests T005 ∥ T006 → components T007 ∥ T008 ∥ T009 → T010 (`TagsPage`, wires components+stores) → T011 (App route, imports `TagsPage`). T010's cascade uses `removeTagFromTodos` from T003.
- **US2 (Phase 4)**: test T012 → T013 (`TodoItem`) → T014 (`TodoList`) → T015 (`TodosPage`). Uses `toggleTag` from T003. Each step depends on the prior (child → parent → page).
- **US3 (Phase 5)**: test T016 → T017 (`TagFilter`) → T018 (`TodosPage` filter state). Builds on US1 (tags) and US2 (assignments).
- **Polish (Phase 6)**: T019 ∥ T020 after all stories land.
- **Note**: `src/App.tsx` is touched in T004 (provider) and T011 (route), and `src/pages/TodosPage.tsx` in T015 (assignment) and T018 (filter) — each pair is in different phases, so they run sequentially, never in the same wave.
