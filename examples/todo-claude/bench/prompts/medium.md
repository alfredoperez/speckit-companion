# Bench prompt — MEDIUM ("Due dates on todos")

A feature **added to the existing todos** — extend the todo item + the todos page. Paste everything between the rules into the specify step. Follow the app's conventions (store slice for state, `lib/storage` for any persistence, presentational components).

---

Add optional due dates to todos, an overdue indicator, and sort-by-due-date.

**Behavior**

- Each todo row has an optional due-date picker (a date input). Changing it sets that todo's due date; clearing it removes the date. Due dates persist with the todo and survive a reload.
- A todo whose due date is strictly before today shows an "Overdue" indicator in its row. A todo with no due date, or one due today or later, shows none.
- A "Sort by due date" control reorders the visible list ascending by due date (soonest first); todos with no due date sort to the end. Turning it off restores insertion order, and turning it back on sorts again.

Keep the existing add / toggle / delete behavior unchanged.

---
