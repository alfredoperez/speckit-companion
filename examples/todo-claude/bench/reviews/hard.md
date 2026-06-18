# Bench reviews — hard

## 2026-06-18 — hard

Feature: **Tags** (new `/tags` route + store slice + localStorage persistence of tags *and* their todo-assignments + a filter row + per-row toggles). Fresh run, both solutions re-implemented since the 2026-06-15 review — the store shapes and the remove-while-filtered handling are different now, so read this section as the current state, not the one below. Reviewed comparatively against the canonical baseline (`examples/todo-claude/src`): `speckit` (stock) and `companion`. Both build clean and pass their suites (speckit 30 tests / 7 files, companion 29 tests / 9 files).

### Ranking (best → worst)

1. **companion** — Correct on every probe, with the cleaner domain model and the deeper test coverage. `Tag {id,name}` + `tagIds[]` on todos means a tag can be renamed/duplicated-by-name without identity drift, and it ships dedicated `TodosPage` + `persistence` integration tests that pin the two hardest behaviors (filter auto-revert, tag+assignment survival across remount). One genuine edge advantage: it filters by tag **id**, so a user-created tag literally named "All" cannot collide with the All control.
2. **speckit** — Also correct on every probe and slightly simpler (tag = bare string, one less type, assignments live as `tags: string[]` on the Todo). Self-heals the stale filter via a derived guard and cascades un-assignment on remove. Two soft edges keep it second: a tag named **"All"** collides with the filter sentinel (duplicate React key + the real tag becomes unselectable), and it has no dedicated `TodosPage`/remount integration test — the filter-revert path is covered only indirectly.

Close call — both are complete and bug-free on the graded behaviors. Companion wins on model robustness and test depth.

### The known failure mode — remove the tag you are currently filtering by

Both solutions **gracefully fall back to "All"**; neither strands the user on a permanently-empty list. They get there two different ways:

- **speckit** — derived, no effect. `TodosPage` computes `const filtering = active !== ALL && tags.includes(active)` and passes `active={filtering ? active : ALL}` to the filter. The instant the active tag leaves `tags`, `filtering` is false, so `visible = todos` (all) and the All control highlights. `active` state still holds the dead name, but it is inert — never read while the tag is gone, and self-corrects if a same-named tag is recreated. Clean, no flash of empty.
- **companion** — effect-based reset. `TodosPage` runs `useEffect(() => { if (activeFilter !== 'All' && !tags.some(t => t.id === activeFilter)) setActiveFilter('All') }, [tags, activeFilter])`. On the removal render the dead id briefly still filters (list empty for one paint), then the effect fires and resets to 'All'. End state correct; one extra render but no user-visible stuck state. Because the filter value is the tag **id** (a UUID), the dead id can never accidentally match a freshly-created tag.

Both also wire the cascade so the removed tag is stripped from every todo: speckit's `TagsPage.handleRemove` calls `removeTag(name)` **then** `untagAll(name)`; companion's `removeTag(id)` dispatches the tag `remove` **and** calls `removeTagFromAllTodos(id)`. Verified in code, not assumed.

### Other probes

- **Filter by a tag, then unassign it from all todos** — both correctly show an empty list while the (still-existing) tag stays selected; re-assigning brings todos back. No stranding, because the tag still exists so the filter is still valid. Correct in both.
- **Create a duplicate-named tag** — both reject an exact-name duplicate. speckit: `if (!name || state.includes(name)) return state`. companion: `if (state.some(t => t.name === name)) return state`. Neither folds case ("Work" vs "work" both allowed) — the spec doesn't require case-insensitivity, so this is acceptable in both, not a defect.
- **Persistence of tags AND assignments across remount** — correct in both. speckit persists two keys (`tags` string[], `todos` with embedded `tags[]`), each seeded from `load(...)` and saved via its own `useEffect`. companion persists `tags` (`Tag[]`) and `todos` (with `tagIds[]`) likewise. companion ships an explicit `persistence.test.tsx` asserting created tags, per-todo assignments, **and** removed-tags-stay-gone all survive an unmount/remount; speckit has no equivalent dedicated test (covered only indirectly). Both seed-normalize legacy todos missing the tag field to `[]`.

### Head-to-head differences

**Data model — the root divergence.**
- speckit: tag = **bare string**. `Todo.tags: string[]` holds assignments directly on the todo; there is no `Tag` type and no separate assignments map. Filter value, toggle identity, and persisted value are all the same string — nothing to reconcile. Cost: a renamed tag would orphan assignments (no rename feature exists, so moot), and the string "All" is overloaded as both sentinel and a legal tag name.
- companion: tag = **object** `{id,name}` (new `Tag` type); todos carry `tagIds: string[]`. Name↔id split, but it's handled consistently (filter by id, label by name) and buys collision-immunity for the "All" sentinel and rename-safety.

**Provider ordering (both correct, but load-bearing for companion).** Both wrap `<TodosProvider><TagsProvider>…`. Companion's `TagsProvider` calls `useTodos()` to get `removeTagFromAllTodos`, so it **must** sit inside `TodosProvider` — and it does. If that order were ever flipped, companion would throw on mount; speckit has no such cross-store dependency (it wires the cascade at the page level instead). Worth noting as a latent fragility, not a current bug.

**Component decomposition.**
- speckit: `TagManager` (create form + list with Remove) on the Tags page; `TagFilter` filter row; `TodoItem`/`TodoList` are prop-driven, tags + `onToggleTag` passed from `TodosPage`. Matches the "components stay presentational, pages wire them" convention.
- companion: splits into `AddTag` (form) + `TagList` (list) on the Tags page; `TagFilter` filter row; same prop-driven `TodoItem`/`TodoList`. Slightly finer-grained, also convention-fit.

**Test coverage.**
- speckit: reducer tests for tags (add/trim/dup/remove) and todos (toggleTag/untagAll), `TagFilter`, `TagManager`, `TagsPage` end-to-end, `App`. No `TodosPage` test, no remount test for tags specifically.
- companion: reducer tests (tags add/empty/dup/remove-cascade; todos toggleTag/removeTagFromAll), `TagFilter`, `TodoItem`, `TagsPage`+nav, and crucially a **`TodosPage.test.tsx`** (filter-by-tag, All-reset, revert-on-remove) plus a **`persistence.test.tsx`** (tags + assignments + removed-stay-gone across remount). Broader, and it directly tests the two trickiest paths.

### Suspected bugs / risks the harness can't catch

- **speckit — tag named "All" collides with the filter sentinel (minor real edge bug).** `TagFilter` builds `options = ['All', ...tags]` and `TodosPage` treats `active === 'All'` as "show everything." If a user creates a tag literally named `All`, the options list has two `All` entries (duplicate React key warning) and selecting the real tag sets `active='All'`, which the page reads as show-all — so that specific tag is unfilterable. Unlikely in practice; companion is immune because it keys the sentinel and filtering on id, not name. Not exercised by an id/label-only acceptance harness.
- **speckit — brief note, not a bug:** the remove cascade lives in `TagsPage.handleRemove` (page-level), not in the tag reducer. Correct as wired, but a second call site that removes a tag without going through the page would skip `untagAll`. No such call site exists today.
- **companion — one extra empty-render on remove-while-filtered (cosmetic).** The effect-based reset means the dead id filters for one paint before `setActiveFilter('All')` runs, so the list can flash empty for a frame. End state is correct; speckit's derived approach avoids even the flash. Negligible.
- **companion — `removeTag` does two dispatches in one handler.** `dispatch({type:'remove'})` on tags + `removeTagFromAllTodos(id)` on todos. Both are React batched within the same handler and both stores persist via their own `useEffect`, so this is safe — confirmed by the passing `persistence.test.tsx` (removed tag stays gone, surviving assignment preserved). No risk found.
- **Both — no localStorage key collision.** todos under `todos`, tags under `tags`; clean separation in both.

### One-line verdict per mode

- **speckit:** Complete and correct on every probe — self-heals the stale filter via a derived guard and cascades un-assignment on remove; second only on the "All"-name sentinel collision and thinner integration tests.
- **companion:** Complete and correct on every probe with the more robust id-based model (sentinel-collision-immune, rename-safe) and the deeper tests (dedicated `TodosPage` + `persistence` integration suites) — the stronger solution, by a hair.

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
