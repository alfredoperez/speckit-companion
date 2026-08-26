# Bench prompt — OVERSIZED ("Boards — deliberately more than one wave")

A feature deliberately sized past the point where a run can hold it in one pass: it spans routes, two store slices, persistence, a shared component layer, and a touch-point on todos. That size is the whole point — a task list this long has real wait-lines in it, so a run that journals its tasks in one end-of-phase burst is visibly different from a run that journals them as it goes. The doctor's verdict is what makes that difference score.

Expect 15+ files and 25+ tasks. Follow the app's conventions (a `pages/` component + a `<Route>` in `App.tsx` + a nav `<Link>` in `Header.tsx`; new store slices under `src/store/` wrapped in `App.tsx`; persistence through `src/lib/storage.ts`; presentational pieces under `components/`).

---

Add Boards so todos can be organised into named boards with ordered columns.

**Behavior**

- A new "Boards" page at the `/boards` route, reachable from a "Boards" link in the header nav. On it the user can create a board by name, see every board, rename one, and delete one. Deleting a board asks for nothing but must not delete the todos on it.
- A board detail page at `/boards/:id` shows that board's columns left to right. The user can add a column, rename a column, reorder columns, and delete a column. Deleting a column moves its todos to the board's first column rather than losing them.
- Each todo can be assigned to exactly one board-and-column, or to none. The todos page shows which board a todo is on, and offers a control to move it to any board and column.
- The board detail page lists each column's todos in an order the user can change by moving a todo up or down within its column.
- A board's summary — its name, its column count, and how many todos it holds — appears on the Boards page and updates as todos move.
- Boards, columns, todo assignments, and the order of todos within a column all persist to `localStorage` and are restored on reload, surviving an app re-mount.
- The todos page gains a board filter — one control per board, plus an "All" control, plus an "Unassigned" control.

Keep the existing add / toggle / delete behavior unchanged, and keep the existing todo list working for a todo assigned to no board.

**Identifiers the acceptance oracle uses** — these exact `data-testid` values must exist: `board-name-input`, `add-board`, `open-board-<name>`, `column-name-input`, `add-column`, `column-<name>`, `delete-column-<name>`, `move-to-<board>-<column>`, `filter-board-<name>`, `filter-board-unassigned`, `filter-board-all`.

---
