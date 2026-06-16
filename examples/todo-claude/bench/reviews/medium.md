# Bench reviews — medium ("Due dates on todos")

## 2026-06-15 — medium

Independent comparative review of the two solutions to the medium feature (optional due dates + overdue badge + sort-by-due toggle). Both build cleanly on the baseline app, both wire the new state through the existing store/reducer (per conventions), neither touches `storage.ts` (correct — persistence rides the store's existing `load`/`save` effect, and `dueDate` serializes for free), and neither changed `index.html`. They differ mainly in *where the logic lives* and *how thoroughly it's tested*.

### Ranking (best → worst)

1. **speckit** — Extracted the date logic into a tested `lib/dueDate.ts` (injectable "today", a non-mutating stable sort), added a presentational `SortToggle` component, and shipped four focused test files. Cleanest separation, most defensible edge-case handling.
2. **companion** — Correct and complete, with strong page-level sort tests, but inlines the overdue check and the sort comparator into components, has a real sort-restore bug risk (see below), and leaves the date logic untested in isolation.

### Head-to-head differences

**Structure / where logic lives**
- *speckit* pulled `todayStr` / `isOverdue` / `sortByDueDate` into `src/lib/dueDate.ts` and added a dedicated `SortToggle.tsx`. `TodosPage` just calls `sortByDueDate(todos)`. This matches the repo's "presentational, prop-driven components; logic in a testable seam" convention best.
- *companion* inlines `isOverdue` as a private function inside `TodoItem.tsx` and inlines the sort comparator as a `useMemo` inside `TodosPage.tsx`. The sort toggle is an inline `<label>` rather than a component. Functional, but the reusable/testable logic is buried in components.

**Naming** — Both are clean and idiomatic. speckit's `setDueDate`/`onSetDueDate`/`sortByDue` and companion's `setDueDate`/`onSetDueDate`/`sortByDueDate` are essentially equivalent. No concerns either way.

**Edge cases**
- *Overdue = strictly before today*: both compare `dueDate < todayStr` against a locally-formatted `YYYY-MM-DD`, so "today" and "future" correctly show no badge. Correct in both. speckit's is unit-tested against an injected today; companion's relies on the real clock.
- *No due date sorts last*: both put undated todos after dated ones. Correct in both.
- *Clearing removes the date*: speckit's reducer **deletes the `dueDate` key** (`const { dueDate, ...rest } = t`) so the field is genuinely absent — and it has a test asserting `'dueDate' in next[0] === false`. companion sets `dueDate: action.dueDate || undefined`, leaving the key present with value `undefined`. Both render and behave identically (the input shows empty, no overdue, sorts last), but speckit's is the cleaner "absent when no due date" the type comment promises.

**Test coverage**
- *speckit*: 4 test files — `dueDate.test.ts` (todayStr formatting, isOverdue boundaries incl. exactly-today, sort ordering + no-mutation + stable-for-equal), `todos.test.tsx` (reducer set/replace/clear/unknown-id), `TodoItem.test.tsx` (input binding, change, clear→undefined, badge present/absent), `TodosPage.test.tsx` (sort on→off round-trip). Broad and boundary-focused.
- *companion*: 2 test files — `TodoItem.test.tsx` (overdue badge at -1/0/+1 day + undated) and a strong `TodosPage.test.tsx` (ascending-with-undated-last, restore insertion order, and a repeated-toggle stability loop). No isolated test of the reducer or the sort/overdue helpers (they're inlined, so they aren't independently testable). Fewer files but the page-level sort tests are genuinely good.

### Suspected bugs / risks the harness can't catch

**companion**
- **Sort toggle "restore insertion order" depends on a stable `Array.prototype.sort` and a comparator that returns `0` for ties.** The comparator returns `0` for two undated todos and `0` for equal dates; combined with `[...todos].sort(...)`, restoring insertion order relies on V8/JSC sort stability. That's safe on modern engines, *but* the comparator returning `0` (rather than a tiebreak on original index) means the "ascending" order itself isn't insertion-stable across todos with the *same* date — order is preserved only because the engine's sort is stable. The harness's tests happen to use distinct dates in the ascending assertion, so a latent same-date instability wouldn't surface. speckit sidesteps this entirely by decorating with the original index and tiebreaking on `a.index - b.index`, so its ordering is explicitly stable regardless of engine.
- **`isOverdue` recomputes "today" on every render with no injection seam.** Correct in practice, but it reads the real clock inside the component, so there's no deterministic unit test for the exactly-today boundary (the companion test uses `dateOffset(0)`, which is correct but clock-dependent). Not a bug, a testability gap.

**speckit**
- **None found.** Timezone handling is local-calendar-based (`getFullYear/getMonth/getDate`) on both the stored `YYYY-MM-DD` and "today", so the string comparison is apples-to-apples and immune to UTC-vs-local off-by-one. The sort is non-mutating, index-tiebroken, and undated-last. Reducer clear truly removes the key. Test ids (`due-date-input`, `overdue-badge`, `sort-due`) are verbatim and one-per-row.

**Both**
- Both format "today" from local date parts and compare against the stored local `YYYY-MM-DD` string — so the overdue boundary is timezone-consistent in both. No UTC/`toISOString()` off-by-one trap in either (a common failure mode here, avoided by both).
- Both persist `dueDate` transparently through the existing store effect; round-tripping through `lib/storage` is fine since it JSON-serializes the whole todo.

### One-line verdict per mode

- **speckit**: Ship it — logic extracted into a tested `dueDate` lib with an injectable clock and an explicitly-stable sort; the most correct and best-covered of the two.
- **companion**: Correct and complete, but the inlined sort comparator leans on engine sort-stability for same-date ordering and the date logic isn't independently tested — solid, a notch below speckit on robustness and separation.
