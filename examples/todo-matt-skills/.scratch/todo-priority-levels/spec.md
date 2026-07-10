Status: ready-for-agent

# Add priority levels to todos

## Problem Statement

Right now every todo in the list carries the same weight. A user with a long list of todos has no way to signal that one item ("file taxes") matters more than another ("buy stamps"), and the list order only ever reflects when things were typed in. Anything urgent gets buried unless the user manually keeps re-typing it at the top or remembers to scroll past everything else.

## Solution

Every todo gets a priority: low, medium, or high. New todos default to medium priority, and the person adding a todo can choose a different priority right there in the add form. Each todo in the list shows a small colored badge for its priority so it's obvious at a glance, and the whole list is sorted with high-priority items first, then medium, then low — so the most important things are always at the top without the user having to do anything extra.

## User Stories

1. As a todo app user, I want new todos to default to medium priority, so that I don't have to think about priority for routine items.
2. As a todo app user, I want to pick a priority (low, medium, or high) when I add a todo, so that I can flag important items right away.
3. As a todo app user, I want each todo to show a colored badge for its priority, so that I can tell at a glance how urgent it is without reading the text.
4. As a todo app user, I want high-priority todos to appear before medium, and medium before low, so that the most important things are always at the top of my list.
5. As a todo app user, I want todos of the same priority to stay in the order I added them, so that the sort feels stable and predictable rather than shuffling items around.
6. As a todo app user, I want completing (checking off) a todo to leave its priority and badge unchanged, so that toggling completion doesn't lose information.
7. As a todo app user, I want deleting a todo to not affect the priority or position of the remaining todos, so that the list stays predictable after I remove something.
8. As a todo app user, I want "Clear completed" to still respect priority sorting for whatever todos remain, so that the list doesn't need to be re-sorted manually afterward.
9. As a todo app user, I want my todos' priorities to persist across page reloads, so that I don't lose that information when I come back to the app.
10. As a todo app user with todos saved from before this feature existed, I want those old todos to still load correctly (treated as medium priority) instead of crashing the app or showing a blank/broken badge, so that the update doesn't break my existing list.
11. As a todo app user, I want the priority badge colors to be visually distinct (e.g., high reads as more urgent/warm, low reads as calmer/cool), so that I can distinguish priority levels without reading the label text.
12. As a developer maintaining this app, I want the sort-by-priority logic to be a small, pure, testable unit, so that ordering behavior can be verified without rendering the full UI.

## Implementation Decisions

- **`Todo` type** (`src/types.ts`) gains a required `priority` field: `'low' | 'medium' | 'high'`.
- **Add flow**: the `add` action in the todos store reducer accepts an optional priority; when omitted it defaults to `'medium'`. The `AddTodo` component gains a priority selector (a native `<select>`, consistent with the app's existing plain-HTML-element style) defaulting to Medium, and passes the chosen value through `addTodo`.
- **Store contract change**: `useTodos().addTodo` changes from `(text: string) => void` to `(text: string, priority?: Priority) => void`, defaulting to `'medium'` inside the reducer so callers that don't pass a priority keep working.
- **Sorting is a derived/display concern, not stored order.** Todos remain stored (and persisted) in insertion order in the reducer's state array — this keeps `add`/`toggle`/`delete`/`clearCompleted` logic unchanged and keeps localStorage's on-disk order stable and easy to reason about. A pure sort helper (e.g. `sortByPriority(todos: Todo[]): Todo[]`) produces the high-to-low view, using a stable sort (JS engines guarantee stable `Array.prototype.sort`) so same-priority todos keep their relative insertion order. This helper is called once where the list is rendered (`TodosPage`, right before handing todos to `TodoList`), not inside the reducer.
- **Badge rendering**: `TodoItem` renders a small colored badge next to the todo text reflecting its priority. Follows the existing inline-style pattern already used throughout `TodoItem`/`TodoList`/`AddTodo` (no CSS module or class-based styling exists in this codebase today, so don't introduce one for this feature alone). Suggested color mapping (exact hex values are an implementation detail, not a contract): high = warm/red, medium = amber/neutral, low = cool/green or gray.
- **Backward compatibility on load**: `load()` in `src/lib/storage.ts` is a generic JSON round-trip with no schema migration today. Loading pre-existing todos (persisted before this feature shipped) that lack a `priority` field must not crash and must not render an unstyled/blank badge. Normalize missing `priority` to `'medium'` at load time — the natural place is either inside `load()`'s consumer in the store (mapping over the loaded array once) or as a small `normalizeTodo`/migration step colocated with the reducer's initializer. Do not change `storage.ts`'s generic signature to be todo-specific; keep the normalization in the todos store, which already owns the `Todo` shape.
- **No editing priority after creation.** The request only asks for setting priority at creation time (defaulting to medium) plus display/sort; changing a todo's priority later is a new action (`type: 'changePriority'`) not requested here — see Out of Scope.

## Testing Decisions

- Primary seam: App-level integration tests in `src/App.test.tsx`, rendering `<App/>` via React Testing Library and driving behavior through the real UI (add form, checkboxes, buttons) — the same seam already used for the existing "Clear completed" feature tests. This exercises the store, `AddTodo`, `TodoList`, and `TodoItem` together, matching how most of this app's user-facing behavior is already verified.
- A good test here asserts observable behavior a user would see (badge text/order in the DOM, which todo text appears first, values surviving a remount) — not implementation details like internal reducer action shapes or the exact sort function's internals.
- Cover in `App.test.tsx`:
  - Adding a todo without touching the priority selector results in a medium-priority badge.
  - Adding todos with each of the three priorities and asserting the rendered order is high, then medium, then low.
  - Two todos added at the same priority keep their add order relative to each other.
  - Toggling completion and deleting a todo don't change the priority badge or reorder the remaining todos unexpectedly.
  - Priority (and correct sort order) survives an unmount/remount (localStorage round-trip), mirroring the existing "persists...across remounts" pattern.
  - Seeding `localStorage` directly with a pre-feature todo shape (no `priority` key) before mount, then asserting the app still renders that todo with a medium badge instead of crashing — covers the backward-compatibility story.
- No new reducer-level (`src/store/todos.test.ts`) unit tests are planned for this feature; that file today only covers `clearCompleted` edge cases, and per the seam decision this feature is verified end-to-end at the App level instead of adding a second seam.

## Out of Scope

- Editing/changing a todo's priority after it's created.
- Filtering the list by priority.
- Any secondary sort key beyond "preserve insertion order within the same priority" (e.g. sorting alphabetically within a priority tier).
- Persisting or exposing priority through any API/backend — this app only has `localStorage`.
- Any visual redesign beyond adding the badge itself (existing inline-style approach is preserved as-is).

## Further Notes

- No `CONTEXT.md`/ADRs exist in this repo yet, so this spec doesn't reference or contradict any domain glossary or prior architectural decision.
- The seam decision (App-level RTL tests only, no new reducer-level tests) was confirmed with the user before writing this spec.
