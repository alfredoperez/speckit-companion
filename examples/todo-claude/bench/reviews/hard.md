# Bench reviews — hard

## 2026-06-15 — hard

Feature: **Tags** (new `/tags` route + store slice + localStorage persistence of tags *and* assignments + filter row). Two solutions reviewed comparatively against the canonical baseline (`examples/todo-claude/src`): `speckit` (stock) and `companion`.

### Ranking (best → worst)

1. **speckit** — Complete and correct. Tags-as-strings keeps test-ids, assignments, and filtering trivially consistent; it is the only solution that auto-reverts the filter to "All" when the active tag is removed, and it ships a test for exactly that edge case.
2. **companion** — Cleaner domain model (`Tag {id,name}`, case-insensitive dedup) and richer tests, but has a real stale-filter bug: removing the tag you're currently filtering by strips the control from the row yet leaves the dead filter active, emptying the list with no visible way back to "All".

### Head-to-head differences

**Tag model — the root divergence.**
- speckit models a tag as a bare **string name**. `tags: string[]`, `assignments: Record<todoId, name[]>`. Filter value *is* the name, assign test-id *is* the name, filter test-id *is* the name — one identity everywhere, so nothing can drift.
- companion models a tag as an **object** `{ id, name }` (new `Tag` type). `tags: Tag[]`, `assignments: Record<todoId, tagId[]>`. The filter *value* is the `id` but the filter/assign *test-ids* are the `name`. Both surfaces are correct because names are deduped case-insensitively, but it carries a name↔id split the string model never has to reconcile.

**Store / persistence.**
- speckit splits persistence into **two keys** — `tags` (string[]) and `tag-assignments` (Record) — each with its own seeding `load(...)` and its own save `useEffect`. Reducer actions: `addTag` / `removeTag` / `toggleAssignment`.
- companion persists the **whole slice under one key** `tags` (`{tags, assignments}`), one `load`, one save `useEffect` on the whole state object. Reducer actions: `add` / `remove` / `toggle`. Also exposes a `tagsForTodo()` selector (unused by the page, which reads `assignments` directly).
- Both keep `todos` on its own key — **no localStorage collision** with the existing todos store in either solution.

**removeTag cascade.** Both reducers correctly rebuild `assignments` stripping the removed tag from every todo (speckit by name, companion by id). Both have a unit test asserting the cascade. Equivalent here.

**Route / nav wiring.** Identical approach and identical correctness: both wrap `<TagsProvider>` inside `<TodosProvider>` in `App.tsx`, add the `/tags` `<Route>`, and add a `<Link to="/tags">Tags</Link>` to `Header.tsx`. `index.html` untouched in both (matches baseline). Both satisfy the exact-text `Tags` nav requirement.

**Component decomposition.**
- speckit: dedicated `TagToggles` (per-row assign chips) + `TagFilterBar` (filter row) components; `TodoItem` itself calls `useTags()` and renders `TagToggles` inline. Tighter — the store reaches into the row.
- companion: `AddTag` (form) + `TagFilter` (filter row); `TodoItem`/`TodoList` stay **prop-driven** (tags/assignments/onToggleTag passed down from `TodosPage`), which is closer to the CLAUDE.md "components stay presentational, pages wire them to the store" convention. Companion also adds extra wiring test-ids (`tags-page`, `tags-empty`, `tags-list`, `tag-row-*`, `tag-remove-*`, `todo-tags-*`) and a proper empty state on the Tags page.

**Filter logic — where they genuinely diverge.**
- speckit `TodosPage` holds `filter` in `useState` **and** runs a `useEffect([filter, tags])` that resets `filter` to `'all'` the moment the active tag disappears from `tags`. So a remove-while-filtered self-heals, and "All" highlights correctly.
- companion `TodosPage` holds `activeFilter` in `useState` with **no such guard**. Filtering computes `todos.filter(t => assignments[t.id]?.includes(activeFilter))`. When the active tag is removed, `TagFilter` stops rendering its control (it only maps current tags), but `activeFilter` still points at the now-dead id → every `includes` is false → empty list, and the only highlighted control is gone (All shows `aria-pressed=false`). Recovery requires the user to click "All".

**Test coverage.**
- speckit: reducer tests (add/trim/dup/remove-cascade/toggle), `TagsPage` (create/clear/empty/dup/remove), `TodoItem` assignment toggles, and a full **`TodosPage.test.tsx`** that covers the filter row, filter-by-tag, All-reset, row-updates-as-tags-change, and crucially **"falls back to all when the active filter tag is removed."** Most thorough, and it directly tests the behavior companion gets wrong.
- companion: reducer tests (add/empty/case-insensitive-dup/toggle/remove-cascade), `TagFilter` component tests (All-only, one-per-tag, active pressed, onSelect id), `TagsPage` (empty state + create). **No `TodosPage` integration test** — so the page-level filter-revert path is entirely untested, which is exactly where its bug lives.
- App-level remount-persistence test is identical in both (covers todos persistence, not tags — neither asserts tag/assignment survival across remount, though the store wiring provides it).

### Suspected bugs / risks the harness can't catch

**companion — stale active filter is not reverted (real bug).** Filter by a tag, then remove that tag on `/tags`: the todos list goes empty and no filter control is highlighted/visible to indicate why; the user must know to click "All" to recover. The prompt's intent ("revert the filter if the active tag was removed") is unmet. Pure-bench acceptance test-ids may not exercise the remove-while-filtered sequence, so an id-only harness can pass this. speckit handles it explicitly and tests it.

**companion — `tagsForTodo()` is dead code.** Exposed on the context but unused (the page reads `assignments` directly). Harmless, minor.

**speckit — none found.** Filtering, revert, cascade, and dedup are all correct and tested. Minor stylistic note only: `TodoItem` pulls `useTags()` itself rather than receiving tags as props (slightly less "presentational" than the CLAUDE.md convention companion follows), but this is a taste call, not a defect.

**Both — tag/assignment persistence across remount works but is asserted only indirectly.** Each store seeds from `load(...)` and saves on change, so tags and assignments do survive a re-mount (verified by reading the wiring). Neither ships an explicit remount test for *tags* specifically; the App remount test only covers todos. Persistence itself is sound in both; the missing coverage is a test gap, not a runtime risk.

**Both — no localStorage key collision.** todos stays under `todos`; tags use `tags`(+`tag-assignments`) (speckit) / `tags` (companion). Clean separation.

**Both — "All" reset works** when clicked directly (both highlight All and show every todo). The divergence is only in the *automatic* revert on tag removal (above).

### One-line verdict per mode

- **speckit:** Ships the feature fully and correctly, including the one edge case companion misses (auto-revert on active-tag removal), with the deepest tests — the better solution.
- **companion:** Cleaner model and broader unit/component tests and a nicer Tags UI, but a real stale-filter bug (no auto-revert when the active tag is removed) plus a missing `TodosPage` integration test that would have caught it.
