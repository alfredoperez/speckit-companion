# Bench prompt — MEDIUM ("Due dates on todos")

A feature **added to the existing todos** — extend the todo item + the todos page. Paste everything between the rules into the specify step. The **Required affordances** pin the user-visible surface so the bench can grade turbo and standard on one yardstick. Implement them exactly, following the app's conventions (store slice for state, `lib/storage` for any persistence, presentational components).

---

Add optional due dates to todos, an overdue indicator, and sort-by-due-date.

**Behavior**

- Each todo row has an optional due-date input (`<input type="date">`). Changing it sets that todo's due date; clearing it removes the date. Due dates persist with the todo.
- A todo whose due date is strictly before today shows an "Overdue" indicator in its row. A todo with no due date, or one due today or later, shows none.
- A "Sort by due date" toggle reorders the visible list ascending by due date (soonest first); todos with no due date sort to the end. Toggling it off restores insertion order.

**Required affordances (the bench grades these — match exactly)**

- Each todo row renders the date input with `data-testid="due-date-input"` (one per row, in list order).
- The overdue indicator has `data-testid="overdue-badge"` and is present in a row **only** when that todo is overdue.
- The sort control has `data-testid="sort-due"`. Clicking it toggles ascending-by-due-date sorting; clicking again returns to insertion order.

Keep the existing add / toggle / delete behavior unchanged.

---
